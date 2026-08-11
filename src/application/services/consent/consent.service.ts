import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessAuthorization } from '../../../domain/entities/consent/access-authorization.entity';
import { AuthorizationStatus } from '../../../domain/enums/authorization-status.enum';
import { PatientService } from '../patients/patient.service';
import { CreateAccessAuthorizationDto } from '../../dto/consent/create-access-authorization.dto';
import { AccessAuthorizationResponseDto } from '../../dto/consent/access-authorization-response.dto';

/**
 * El consentimiento explícito de la Ley 29733: solo el titular vigente
 * puede otorgar u revocar (ver PatientService.assertIsCurrentTitleholder
 * — tutor mientras el paciente es menor, el paciente mismo desde los 18).
 * No hay excepción de emergencia acá: eso es exclusivo de
 * AccessDecisionService y nunca se modela como una fila de esta tabla.
 */
@Injectable()
export class ConsentService {
  constructor(
    @InjectRepository(AccessAuthorization)
    private readonly authRepository: Repository<AccessAuthorization>,
    private readonly patientService: PatientService,
  ) {}

  async grant(
    patientId: number,
    dto: CreateAccessAuthorizationDto,
    currentUserId: number,
  ): Promise<AccessAuthorizationResponseDto> {
    await this.patientService.assertIsCurrentTitleholder(
      patientId,
      currentUserId,
    );

    const authorization = this.authRepository.create({
      patientId,
      healthFacilityId: dto.healthFacilityId,
      grantedByUserId: currentUserId,
      scope: dto.scope,
      status: AuthorizationStatus.ACTIVA,
      grantedAt: new Date(),
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      notes: dto.notes ?? null,
      createdAt: new Date(),
      createdById: currentUserId,
    });
    const saved = await this.authRepository.save(authorization);
    return this.toResponseDto(saved);
  }

  async revoke(
    patientId: number,
    authorizationId: number,
    currentUserId: number,
  ): Promise<AccessAuthorizationResponseDto> {
    await this.patientService.assertIsCurrentTitleholder(
      patientId,
      currentUserId,
    );

    const authorization = await this.authRepository.findOne({
      where: { id: authorizationId, patientId },
    });
    if (!authorization) {
      throw new NotFoundException('Autorización no encontrada');
    }

    authorization.status = AuthorizationStatus.REVOCADA;
    authorization.revokedAt = new Date();
    authorization.updatedAt = new Date();
    authorization.updatedById = currentUserId;
    const saved = await this.authRepository.save(authorization);
    return this.toResponseDto(saved);
  }

  async findByPatient(
    patientId: number,
  ): Promise<AccessAuthorizationResponseDto[]> {
    const authorizations = await this.authRepository.find({
      where: { patientId },
      order: { grantedAt: 'DESC' },
    });
    return authorizations.map((a) => this.toResponseDto(a));
  }

  private toResponseDto(
    authorization: AccessAuthorization,
  ): AccessAuthorizationResponseDto {
    return {
      id: authorization.id,
      patientId: authorization.patientId,
      healthFacilityId: authorization.healthFacilityId,
      grantedByUserId: authorization.grantedByUserId,
      scope: authorization.scope,
      status: authorization.status,
      grantedAt: authorization.grantedAt,
      revokedAt: authorization.revokedAt,
      expiresAt: authorization.expiresAt,
      notes: authorization.notes,
    };
  }
}
