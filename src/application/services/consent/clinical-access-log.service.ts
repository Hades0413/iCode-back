import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicalAccessLog } from '../../../domain/entities/consent/clinical-access-log.entity';
import { AuthorizationScope } from '../../../domain/enums/authorization-scope.enum';
import { AccessLogResponseDto } from '../../dto/consent/access-log-response.dto';

export interface RecordAccessLogInput {
  patientId: number;
  accessedByUserId: number;
  healthFacilityId: number;
  requestedScope: AuthorizationScope;
  granted: boolean;
  wasEmergencyOverride: boolean;
  denialReason?: string | null;
  ipAddress?: string | null;
}

/**
 * Bitácora de accesos append-only (trazabilidad exigida por la
 * NTS 139-MINSA) — se escribe siempre, tanto si el acceso se concede
 * como si se deniega, para poder auditar intentos.
 */
@Injectable()
export class ClinicalAccessLogService {
  constructor(
    @InjectRepository(ClinicalAccessLog)
    private readonly logRepository: Repository<ClinicalAccessLog>,
  ) {}

  async record(input: RecordAccessLogInput): Promise<void> {
    const entry = this.logRepository.create({
      patientId: input.patientId,
      accessedByUserId: input.accessedByUserId,
      healthFacilityId: input.healthFacilityId,
      accessedAt: new Date(),
      requestedScope: input.requestedScope,
      granted: input.granted,
      wasEmergencyOverride: input.wasEmergencyOverride,
      denialReason: input.denialReason ?? null,
      ipAddress: input.ipAddress ?? null,
    });
    await this.logRepository.save(entry);
  }

  async findByPatient(patientId: number): Promise<AccessLogResponseDto[]> {
    const logs = await this.logRepository.find({
      where: { patientId },
      order: { accessedAt: 'DESC' },
    });
    return logs.map((log) => ({
      id: log.id,
      patientId: log.patientId,
      accessedByUserId: log.accessedByUserId,
      healthFacilityId: log.healthFacilityId,
      accessedAt: log.accessedAt,
      requestedScope: log.requestedScope,
      granted: log.granted,
      wasEmergencyOverride: log.wasEmergencyOverride,
      denialReason: log.denialReason,
    }));
  }
}
