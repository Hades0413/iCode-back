import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../../../domain/entities/patients/patient.entity';
import { ClinicalRecordType } from '../../../domain/enums/clinical-record-type.enum';
import { TitleTransferService } from '../patients/title-transfer.service';
import { ClinicalRecordService } from './clinical-record.service';
import { TransitionFileResponseDto } from '../../dto/clinical/transition-file-response.dto';

/**
 * Requisito #6: la "ficha de transición" portable. Agrupa el historial
 * completo del paciente por tipo — a diferencia del endpoint simulado de
 * IPRESS (ver ConsentModule), esto no pasa por AccessDecisionService: es
 * el propio titular pidiendo SU información completa, no un tercero.
 */
@Injectable()
export class TransitionFileService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    private readonly titleTransferService: TitleTransferService,
    private readonly clinicalRecordService: ClinicalRecordService,
  ) {}

  async generate(patientId: number): Promise<TransitionFileResponseDto> {
    const patient = await this.patientRepository.findOne({
      where: { id: patientId },
    });
    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }

    const records = await this.clinicalRecordService.findByPatient(patientId);
    const byType = (type: ClinicalRecordType) =>
      records.filter((r) => r.recordType === (type as string));

    return {
      patientId: patient.id,
      fullName: `${patient.firstName} ${patient.lastName}`,
      documentType: patient.documentType,
      documentNumber: patient.documentNumber,
      dateOfBirth: patient.dateOfBirth,
      bloodType: patient.bloodType,
      isAdult: this.titleTransferService.isAdult(patient.dateOfBirth),
      diagnoses: byType(ClinicalRecordType.DIAGNOSTICO),
      medications: byType(ClinicalRecordType.MEDICACION),
      allergies: byType(ClinicalRecordType.ALERGIA),
      surgeries: byType(ClinicalRecordType.CIRUGIA),
      exams: byType(ClinicalRecordType.EXAMEN),
      generatedAt: new Date(),
    };
  }
}
