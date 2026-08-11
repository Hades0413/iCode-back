import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ClinicalRecord } from '../../../domain/entities/clinical/clinical-record.entity';
import { Patient } from '../../../domain/entities/patients/patient.entity';
import { SensitivityLevel } from '../../../domain/enums/sensitivity-level.enum';
import { CreateClinicalRecordDto } from '../../dto/clinical/create-clinical-record.dto';
import { ClinicalRecordResponseDto } from '../../dto/clinical/clinical-record-response.dto';

@Injectable()
export class ClinicalRecordService {
  constructor(
    @InjectRepository(ClinicalRecord)
    private readonly recordRepository: Repository<ClinicalRecord>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
  ) {}

  async create(
    patientId: number,
    dto: CreateClinicalRecordDto,
    recordedByUserId: number,
  ): Promise<ClinicalRecordResponseDto> {
    await this.assertPatientExists(patientId);

    const record = this.recordRepository.create({
      patientId,
      recordType: dto.recordType,
      sensitivityLevel: dto.sensitivityLevel,
      title: dto.title,
      details: dto.details ?? null,
      occurredAt: dto.occurredAt ?? null,
      healthFacilityId: dto.healthFacilityId ?? null,
      recordedByUserId,
      createdAt: new Date(),
      createdById: recordedByUserId,
    });
    const saved = await this.recordRepository.save(record);
    return this.toResponseDto(saved);
  }

  /** Vista interna completa (CLINICAL_RECORD_READ) — sin filtrar por consentimiento: es para el propio equipo clínico, no para una consulta externa. */
  async findByPatient(patientId: number): Promise<ClinicalRecordResponseDto[]> {
    await this.assertPatientExists(patientId);
    const records = await this.recordRepository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
    return records.map((r) => this.toResponseDto(r));
  }

  /** Usado por AccessDecisionService/ConsentModule: solo lo que cae dentro de los niveles ya autorizados. */
  async findByPatientAndSensitivity(
    patientId: number,
    allowedLevels: SensitivityLevel[],
  ): Promise<ClinicalRecord[]> {
    if (allowedLevels.length === 0) {
      return [];
    }
    return this.recordRepository.find({
      where: { patientId, sensitivityLevel: In(allowedLevels) },
      order: { createdAt: 'DESC' },
    });
  }

  private async assertPatientExists(patientId: number): Promise<void> {
    const exists = await this.patientRepository.exists({
      where: { id: patientId },
    });
    if (!exists) {
      throw new NotFoundException('Paciente no encontrado');
    }
  }

  toResponseDto(record: ClinicalRecord): ClinicalRecordResponseDto {
    return {
      id: record.id,
      patientId: record.patientId,
      recordType: record.recordType,
      sensitivityLevel: record.sensitivityLevel,
      title: record.title,
      details: record.details,
      occurredAt: record.occurredAt,
      healthFacilityId: record.healthFacilityId,
      recordedByUserId: record.recordedByUserId,
    };
  }
}
