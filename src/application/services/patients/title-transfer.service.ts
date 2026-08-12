import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../../../domain/entities/patients/patient.entity';
import { LegalGuardian } from '../../../domain/entities/patients/legal-guardian.entity';
import * as ageUtil from '../../../common/utils/age.util';

export interface TitleTransferResult {
  transferred: boolean;
  /** true si ya es adulto pero todavía no tiene su propio "User" para iniciar sesión — no lo creamos acá, requiere que se registre. */
  patientNeedsOwnAccount: boolean;
}

/**
 * Dueño único de la regla "quién puede autorizar accesos sobre este
 * paciente hoy" (requisito #3 — traspaso de titularidad a los 18).
 *
 * Deliberadamente NO guarda un flag "isAdult" en "Patient": se calcula
 * siempre desde "DateOfBirth", así nunca puede quedar desactualizado por
 * falta de un cron/job que lo actualice (fail-safe). "transferIfEligible"
 * es la mitad explícita/auditable: desactiva tutores cuando corresponde,
 * pensada para llamarse desde un endpoint administrativo o, en
 * producción real, un job diario — acá no hay scheduler, se dispara a
 * mano o de forma perezosa antes de decisiones sensibles (ver
 * ConsentService.grant).
 */
@Injectable()
export class TitleTransferService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(LegalGuardian)
    private readonly guardianRepository: Repository<LegalGuardian>,
  ) {}

  /** Delega en common/utils/age.util.ts — única fuente de verdad para la edad, compartida sin acoplar módulos (ver ese archivo). */
  isAdult(dateOfBirth: string): boolean {
    return ageUtil.isAdult(dateOfBirth);
  }

  formatAge(dateOfBirth: string): string {
    return ageUtil.formatAge(dateOfBirth);
  }

  monthsToEighteen(dateOfBirth: string): number {
    return ageUtil.monthsToEighteen(dateOfBirth);
  }

  turnedEighteenAt(dateOfBirth: string): string | null {
    return ageUtil.turnedEighteenAt(dateOfBirth);
  }

  /**
   * null significa "nadie puede autorizar accesos ahora mismo" — un
   * paciente adulto que todavía no vinculó su propio "User", o un menor
   * sin ningún tutor activo. ConsentService debe tratar eso como bloqueo,
   * no como "cualquiera puede".
   */
  async getCurrentTitleholderUserId(patientId: number): Promise<number | null> {
    const patient = await this.patientRepository.findOne({
      where: { id: patientId },
    });
    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }

    if (this.isAdult(patient.dateOfBirth)) {
      return patient.userId;
    }

    const primaryActive = await this.guardianRepository.findOne({
      where: { patientId, isActive: true, isPrimary: true },
    });
    if (primaryActive) {
      return primaryActive.userId;
    }

    const anyActive = await this.guardianRepository.findOne({
      where: { patientId, isActive: true },
    });
    return anyActive?.userId ?? null;
  }

  async transferIfEligible(patientId: number): Promise<TitleTransferResult> {
    const patient = await this.patientRepository.findOne({
      where: { id: patientId },
    });
    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }

    if (!this.isAdult(patient.dateOfBirth)) {
      return { transferred: false, patientNeedsOwnAccount: false };
    }

    const activeGuardians = await this.guardianRepository.find({
      where: { patientId, isActive: true },
    });

    if (activeGuardians.length === 0) {
      return {
        transferred: false,
        patientNeedsOwnAccount: patient.userId === null,
      };
    }

    const now = new Date();
    await this.guardianRepository.update(
      { patientId, isActive: true },
      { isActive: false, deactivatedAt: now },
    );

    return {
      transferred: true,
      patientNeedsOwnAccount: patient.userId === null,
    };
  }
}
