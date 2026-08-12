import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../../../domain/entities/patients/patient.entity';
import { LegalGuardian } from '../../../domain/entities/patients/legal-guardian.entity';

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

  isAdult(dateOfBirth: string): boolean {
    const dob = new Date(dateOfBirth);
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const hasHadBirthdayThisYear =
      now.getMonth() > dob.getMonth() ||
      (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
    if (!hasHadBirthdayThisYear) {
      age -= 1;
    }
    return age >= 18;
  }

  /**
   * "17a 11m" — la edad actual ya formateada. Usado por el dominio de
   * transición (ver PatientTransitionService) para no reimplementar el
   * cálculo de edad en dos lugares — la única fuente de verdad para "qué
   * edad tiene" sigue siendo "DateOfBirth", nunca una columna guardada.
   */
  formatAge(dateOfBirth: string): string {
    const dob = new Date(dateOfBirth);
    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    let months = now.getMonth() - dob.getMonth();
    if (now.getDate() < dob.getDate()) {
      months -= 1;
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    return `${years}a ${months}m`;
  }

  /**
   * Positivo = faltan N meses para los 18; 0 o negativo = ya cumplió
   * hace |N| meses. Base de las ventanas de tiempo del dominio de
   * transición (habilitación a los 3 meses, aviso a la posta a los 2,
   * firma en el último mes — ver PUENTE18_FRONTEND_INTEGRATION.md).
   */
  monthsToEighteen(dateOfBirth: string): number {
    const dob = new Date(dateOfBirth);
    const eighteenthBirthday = new Date(dob);
    eighteenthBirthday.setFullYear(dob.getFullYear() + 18);
    const now = new Date();
    let months =
      (eighteenthBirthday.getFullYear() - now.getFullYear()) * 12 +
      (eighteenthBirthday.getMonth() - now.getMonth());
    if (eighteenthBirthday.getDate() < now.getDate()) {
      months -= 1;
    }
    return months;
  }

  /** null si todavía no cumplió 18. */
  turnedEighteenAt(dateOfBirth: string): string | null {
    if (!this.isAdult(dateOfBirth)) {
      return null;
    }
    const dob = new Date(dateOfBirth);
    const eighteenthBirthday = new Date(dob);
    eighteenthBirthday.setFullYear(dob.getFullYear() + 18);
    return eighteenthBirthday.toISOString().slice(0, 10);
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
