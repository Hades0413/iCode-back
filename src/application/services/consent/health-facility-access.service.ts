import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../../../domain/entities/patients/patient.entity';
import { HealthFacilityStaff } from '../../../domain/entities/facilities/health-facility-staff.entity';
import { ClinicalRecordService } from '../clinical/clinical-record.service';
import { AccessDecisionService } from './access-decision.service';
import { ClinicalAccessLogService } from './clinical-access-log.service';
import { QueryClinicalSummaryDto } from '../../dto/consent/query-clinical-summary.dto';
import { ClinicalSummaryResponseDto } from '../../dto/consent/clinical-summary-response.dto';

export interface RequestingStaffContext {
  userId: number;
  ipAddress?: string | null;
}

/**
 * El requisito #4: "API para que un centro de salud (simulado) consulte
 * el resumen clínico del paciente, con registro de quién accedió y
 * cuándo". Orquesta, sin decidir nada por sí misma: AccessDecisionService
 * decide, ClinicalAccessLogService deja constancia (siempre, se conceda o
 * no), ClinicalRecordService trae los datos ya filtrados por el alcance
 * concedido.
 *
 * El paciente se busca por documento, no por Id interno: un centro de
 * salud real solo conoce el DNI que el paciente le muestra, no nuestro
 * Id autogenerado.
 */
@Injectable()
export class HealthFacilityAccessService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(HealthFacilityStaff)
    private readonly staffRepository: Repository<HealthFacilityStaff>,
    private readonly accessDecisionService: AccessDecisionService,
    private readonly clinicalAccessLogService: ClinicalAccessLogService,
    private readonly clinicalRecordService: ClinicalRecordService,
  ) {}

  async queryClinicalSummary(
    documentNumber: string,
    requestingStaff: RequestingStaffContext,
    dto: QueryClinicalSummaryDto,
  ): Promise<ClinicalSummaryResponseDto> {
    const staffAssignment = await this.staffRepository.findOne({
      where: { userId: requestingStaff.userId },
    });
    if (!staffAssignment) {
      throw new ForbiddenException(
        'Tu usuario no está vinculado a ningún centro de salud (HealthFacilityStaff)',
      );
    }
    const healthFacilityId = staffAssignment.healthFacilityId;

    const patient = await this.patientRepository.findOne({
      where: { documentNumber },
    });
    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }

    const isEmergency = dto.isEmergency ?? false;
    const decision = await this.accessDecisionService.evaluate(
      patient.id,
      healthFacilityId,
      dto.scope,
      isEmergency,
    );

    await this.clinicalAccessLogService.record({
      patientId: patient.id,
      accessedByUserId: requestingStaff.userId,
      healthFacilityId,
      requestedScope: dto.scope,
      granted: decision.granted,
      wasEmergencyOverride: decision.wasEmergencyOverride,
      denialReason: decision.denialReason,
      ipAddress: requestingStaff.ipAddress,
    });

    if (!decision.granted || !decision.effectiveScope) {
      throw new ForbiddenException(decision.denialReason ?? 'Acceso denegado');
    }

    const allowedLevels = this.accessDecisionService.toSensitivityLevels(
      decision.effectiveScope,
    );
    const records =
      await this.clinicalRecordService.findByPatientAndSensitivity(
        patient.id,
        allowedLevels,
      );

    return {
      patientId: patient.id,
      fullName: `${patient.firstName} ${patient.lastName}`,
      bloodType: patient.bloodType,
      grantedScope: decision.effectiveScope,
      wasEmergencyOverride: decision.wasEmergencyOverride,
      records: records.map((r) => this.clinicalRecordService.toResponseDto(r)),
    };
  }
}
