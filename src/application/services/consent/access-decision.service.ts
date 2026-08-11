import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessAuthorization } from '../../../domain/entities/consent/access-authorization.entity';
import { AuthorizationScope } from '../../../domain/enums/authorization-scope.enum';
import { AuthorizationStatus } from '../../../domain/enums/authorization-status.enum';
import { SensitivityLevel } from '../../../domain/enums/sensitivity-level.enum';

export interface AccessDecision {
  granted: boolean;
  /** null si "granted" es false. Puede ser menor a lo pedido (ej. pidieron TODA, solo hay autorización BASICA). */
  effectiveScope: AuthorizationScope | null;
  wasEmergencyOverride: boolean;
  denialReason: string | null;
}

/**
 * El único lugar que decide si un centro de salud puede ver la
 * información clínica de un paciente — implementa exactamente la regla
 * legal (ver prompt_contexto_backend_puente18.md, sección 2):
 *
 *  - BASICA (alergias, diagnósticos, medicación, cirugías, grupo
 *    sanguíneo): requiere autorización vigente, SALVO excepción de
 *    emergencia con riesgo de vida ("isEmergency"), en cuyo caso se
 *    concede sin autorización previa pero queda marcado como tal en la
 *    bitácora.
 *  - SENSIBLE (VIH, salud sexual, genética...): SIEMPRE requiere
 *    autorización vigente explícita. La excepción de emergencia NUNCA
 *    aplica acá, sin importar el flag.
 *
 * No escribe en la bitácora — eso es responsabilidad de
 * ClinicalAccessLogService, para que esta clase se pueda testear como
 * pura lógica de decisión sin tocar la base de datos de logs.
 */
@Injectable()
export class AccessDecisionService {
  constructor(
    @InjectRepository(AccessAuthorization)
    private readonly authRepository: Repository<AccessAuthorization>,
  ) {}

  async evaluate(
    patientId: number,
    healthFacilityId: number,
    requestedScope: AuthorizationScope,
    isEmergency: boolean,
  ): Promise<AccessDecision> {
    const basicAuthorized = await this.hasActiveAuthorization(
      patientId,
      healthFacilityId,
      [AuthorizationScope.BASICA, AuthorizationScope.TODA],
    );
    const sensitiveAuthorized = await this.hasActiveAuthorization(
      patientId,
      healthFacilityId,
      [AuthorizationScope.SENSIBLE, AuthorizationScope.TODA],
    );

    const basicAllowed = basicAuthorized || isEmergency;
    const wasEmergencyOverride =
      !basicAuthorized && isEmergency && basicAllowed;

    switch (requestedScope) {
      case AuthorizationScope.BASICA:
        return basicAllowed
          ? {
              granted: true,
              effectiveScope: AuthorizationScope.BASICA,
              wasEmergencyOverride,
              denialReason: null,
            }
          : this.denied('Sin autorización vigente para información básica');

      case AuthorizationScope.SENSIBLE:
        return sensitiveAuthorized
          ? {
              granted: true,
              effectiveScope: AuthorizationScope.SENSIBLE,
              wasEmergencyOverride: false,
              denialReason: null,
            }
          : this.denied(
              'Sin autorización vigente para información sensible — la información sensible siempre requiere autorización expresa, sin excepción de emergencia',
            );

      case AuthorizationScope.TODA:
        if (basicAllowed && sensitiveAuthorized) {
          return {
            granted: true,
            effectiveScope: AuthorizationScope.TODA,
            wasEmergencyOverride,
            denialReason: null,
          };
        }
        if (basicAllowed) {
          return {
            granted: true,
            effectiveScope: AuthorizationScope.BASICA,
            wasEmergencyOverride,
            denialReason: null,
          };
        }
        if (sensitiveAuthorized) {
          return {
            granted: true,
            effectiveScope: AuthorizationScope.SENSIBLE,
            wasEmergencyOverride: false,
            denialReason: null,
          };
        }
        return this.denied(
          'Sin autorización vigente para información básica ni sensible',
        );
    }
  }

  /** BASICA -> [BASICA], SENSIBLE -> [SENSIBLE], TODA -> ambas. */
  toSensitivityLevels(scope: AuthorizationScope): SensitivityLevel[] {
    switch (scope) {
      case AuthorizationScope.BASICA:
        return [SensitivityLevel.BASICA];
      case AuthorizationScope.SENSIBLE:
        return [SensitivityLevel.SENSIBLE];
      case AuthorizationScope.TODA:
        return [SensitivityLevel.BASICA, SensitivityLevel.SENSIBLE];
    }
  }

  private denied(reason: string): AccessDecision {
    return {
      granted: false,
      effectiveScope: null,
      wasEmergencyOverride: false,
      denialReason: reason,
    };
  }

  private async hasActiveAuthorization(
    patientId: number,
    healthFacilityId: number,
    scopes: AuthorizationScope[],
  ): Promise<boolean> {
    const count = await this.authRepository
      .createQueryBuilder('a')
      .where('a.patientId = :patientId', { patientId })
      .andWhere('a.healthFacilityId = :healthFacilityId', { healthFacilityId })
      .andWhere('a.status = :status', { status: AuthorizationStatus.ACTIVA })
      .andWhere('a.scope IN (:...scopes)', { scopes })
      .andWhere('(a.expiresAt IS NULL OR a.expiresAt > NOW())')
      .getCount();
    return count > 0;
  }
}
