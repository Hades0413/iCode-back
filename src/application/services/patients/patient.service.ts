import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../../../domain/entities/patients/patient.entity';
import { LegalGuardian } from '../../../domain/entities/patients/legal-guardian.entity';
import { CreatePatientDto } from '../../dto/patients/create-patient.dto';
import { CreateLegalGuardianDto } from '../../dto/patients/create-legal-guardian.dto';
import {
  LegalGuardianSummaryDto,
  PatientResponseDto,
} from '../../dto/patients/patient-response.dto';
import { TitleTransferService } from './title-transfer.service';

@Injectable()
export class PatientService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(LegalGuardian)
    private readonly guardianRepository: Repository<LegalGuardian>,
    private readonly titleTransferService: TitleTransferService,
  ) {}

  async create(
    dto: CreatePatientDto,
    currentUserId: number,
  ): Promise<PatientResponseDto> {
    const existing = await this.patientRepository.findOne({
      where: { documentNumber: dto.documentNumber },
    });
    if (existing) {
      throw new ConflictException('Ya existe un paciente con ese documento');
    }

    const patient = this.patientRepository.create({
      documentType: dto.documentType,
      documentNumber: dto.documentNumber,
      firstName: dto.firstName,
      lastName: dto.lastName,
      dateOfBirth: dto.dateOfBirth,
      bloodType: dto.bloodType ?? null,
      userId: null,
      state: true,
      createdAt: new Date(),
      createdById: currentUserId,
    });
    const saved = await this.patientRepository.save(patient);
    return this.toResponseDto(saved, []);
  }

  async findById(id: number): Promise<PatientResponseDto> {
    const patient = await this.getPatientOrFail(id);
    const guardians = await this.guardianRepository.find({
      where: { patientId: id },
    });
    return this.toResponseDto(patient, guardians);
  }

  async addGuardian(
    patientId: number,
    dto: CreateLegalGuardianDto,
    currentUserId: number,
  ): Promise<LegalGuardianSummaryDto> {
    await this.getPatientOrFail(patientId);

    const guardian = this.guardianRepository.create({
      patientId,
      userId: dto.userId,
      relationshipType: dto.relationshipType,
      isPrimary: dto.isPrimary ?? false,
      isActive: true,
      createdAt: new Date(),
      createdById: currentUserId,
    });
    const saved = await this.guardianRepository.save(guardian);
    return this.toGuardianDto(saved);
  }

  /**
   * Defensa en profundidad: el permiso "CONSENT_MANAGE" solo dice que el
   * usuario PUEDE gestionar autorizaciones en general, no que sea el
   * titular de ESTE paciente puntual — eso se valida acá, a nivel de
   * servicio, no en el guard de permisos (que es a propósito ciego a
   * filas concretas, ver PermissionGuard).
   */
  async assertIsCurrentTitleholder(
    patientId: number,
    userId: number,
  ): Promise<void> {
    const titleholderId =
      await this.titleTransferService.getCurrentTitleholderUserId(patientId);
    if (titleholderId === null || titleholderId !== userId) {
      throw new ForbiddenException(
        'Solo el titular vigente (el paciente adulto, o su tutor activo mientras es menor) puede realizar esta acción',
      );
    }
  }

  private async getPatientOrFail(id: number): Promise<Patient> {
    const patient = await this.patientRepository.findOne({ where: { id } });
    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }
    return patient;
  }

  private toResponseDto(
    patient: Patient,
    guardians: LegalGuardian[],
  ): PatientResponseDto {
    const isAdult = this.titleTransferService.isAdult(patient.dateOfBirth);
    const activePrimary = guardians.find((g) => g.isActive && g.isPrimary);
    const activeAny = guardians.find((g) => g.isActive);
    const currentTitleholderUserId = isAdult
      ? patient.userId
      : ((activePrimary ?? activeAny)?.userId ?? null);

    return {
      id: patient.id,
      documentType: patient.documentType,
      documentNumber: patient.documentNumber,
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth,
      bloodType: patient.bloodType,
      isAdult,
      currentTitleholderUserId,
      guardians: guardians.map((g) => this.toGuardianDto(g)),
    };
  }

  private toGuardianDto(guardian: LegalGuardian): LegalGuardianSummaryDto {
    return {
      id: guardian.id,
      userId: guardian.userId,
      relationshipType: guardian.relationshipType,
      isPrimary: guardian.isPrimary,
      isActive: guardian.isActive,
    };
  }
}
