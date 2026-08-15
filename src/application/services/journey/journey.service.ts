import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { Patient } from '../../../domain/entities/patients/patient.entity';
import { LegalGuardian } from '../../../domain/entities/patients/legal-guardian.entity';
import {
  AppointmentDetails,
  PatientTransition,
} from '../../../domain/entities/patients/patient-transition.entity';
import { JourneyChecklistItem } from '../../../domain/entities/journey/journey-checklist-item.entity';
import { JourneyMedication } from '../../../domain/entities/journey/journey-medication.entity';
import { JourneyAllergy } from '../../../domain/entities/journey/journey-allergy.entity';
import { JourneyContact } from '../../../domain/entities/journey/journey-contact.entity';
import { JourneyGuideEntry } from '../../../domain/entities/journey/journey-guide-entry.entity';
import { JourneyMessage } from '../../../domain/entities/journey/journey-message.entity';
import { User } from '../../../domain/entities/user.entity';
import { RelationshipType } from '../../../domain/enums/relationship-type.enum';
import { ClinicalSummaryStatus } from '../../../domain/enums/clinical-summary-status.enum';
import { ReferralReviewStatus } from '../../../domain/enums/referral-review-status.enum';
import { TransitionState } from '../../../domain/enums/transition-state.enum';
import { PatientTransitionService } from '../transition/patient-transition.service';
import { JourneyAccessResponseDto } from '../../dto/journey/journey-response.dto';
import { ReportAppointmentDto } from '../../dto/journey/report-appointment.dto';

/**
 * Estados en los que ya pasó (o dejó de importar) la primera cita: llegado
 * acá, autoregistrar una cita nueva por este camino ya no tiene sentido —
 * es tarea del especialista, no de este atajo del paciente.
 */
const BEYOND_FIRST_APPOINTMENT = new Set<TransitionState>([
  TransitionState.FIRST_CARE_DONE,
  TransitionState.LOST_TO_FOLLOW_UP,
  TransitionState.READMITTED,
]);

/** 6 caracteres, sin 0/O ni 1/I/L (se confunden al dictarlos por teléfono o leerlos en la consulta). */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const MAX_CODE_ATTEMPTS = 5;

const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  [RelationshipType.MADRE]: 'madre',
  [RelationshipType.PADRE]: 'padre',
  [RelationshipType.TUTOR_LEGAL]: 'tutor legal',
  [RelationshipType.OTRO]: 'tutor',
};

/**
 * "Mi recorrido" — la app del paciente y de quien lo acompaña. Depende
 * de TransitionModule (findDetail para lo que ya calcula la cohorte),
 * nunca al revés. La regla que no se puede romper: acceso revocado es
 * 200 con "access:'REVOKED'", nunca 403/404 — ver
 * PUENTE18_FRONTEND_INTEGRATION.md, sección 6.
 */
@Injectable()
export class JourneyService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(LegalGuardian)
    private readonly guardianRepository: Repository<LegalGuardian>,
    @InjectRepository(PatientTransition)
    private readonly transitionRepository: Repository<PatientTransition>,
    @InjectRepository(JourneyChecklistItem)
    private readonly checklistRepository: Repository<JourneyChecklistItem>,
    @InjectRepository(JourneyMedication)
    private readonly medicationRepository: Repository<JourneyMedication>,
    @InjectRepository(JourneyAllergy)
    private readonly allergyRepository: Repository<JourneyAllergy>,
    @InjectRepository(JourneyContact)
    private readonly contactRepository: Repository<JourneyContact>,
    @InjectRepository(JourneyGuideEntry)
    private readonly guideRepository: Repository<JourneyGuideEntry>,
    @InjectRepository(JourneyMessage)
    private readonly messageRepository: Repository<JourneyMessage>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly patientTransitionService: PatientTransitionService,
  ) {}

  async getJourney(currentUserId: number): Promise<JourneyAccessResponseDto> {
    const ownedPatient = await this.patientRepository.findOne({
      where: { userId: currentUserId },
    });
    if (ownedPatient) {
      return this.buildGrantedResponse(ownedPatient.id, 'OWNER', 'Tú');
    }

    const guardian = await this.guardianRepository.findOne({
      where: { userId: currentUserId, isActive: true },
    });
    if (!guardian) {
      throw new NotFoundException('No hay un paciente asociado a esta cuenta');
    }
    const relationship = RELATIONSHIP_LABELS[guardian.relationshipType];
    if (!guardian.hasJourneyAccess) {
      const patient = await this.getPatientOrFail(guardian.patientId);
      return {
        access: 'REVOKED',
        viewer: this.buildViewer('GUARDIAN', relationship),
        subjectInitials: this.initialsOf(patient),
      };
    }
    return this.buildGrantedResponse(
      guardian.patientId,
      'GUARDIAN',
      relationship,
    );
  }

  async setChecklistItemDone(
    itemId: number,
    done: boolean,
    currentUserId: number,
  ): Promise<JourneyAccessResponseDto> {
    const item = await this.checklistRepository.findOne({
      where: { id: itemId },
    });
    if (!item) {
      throw new NotFoundException('Ítem de checklist no encontrado');
    }
    const patient = await this.getOwnedPatientOrFail(currentUserId);
    if (patient.id !== item.patientId) {
      throw new ForbiddenException('Ese ítem no es de tu checklist');
    }

    item.done = done;
    item.updatedAt = new Date();
    item.updatedById = currentUserId;
    await this.checklistRepository.save(item);
    return this.buildGrantedResponse(patient.id, 'OWNER', 'Tú');
  }

  async sendReminder(
    text: string,
    currentUserId: number,
  ): Promise<JourneyAccessResponseDto> {
    const guardian = await this.guardianRepository.findOne({
      where: { userId: currentUserId, isActive: true },
    });
    if (!guardian) {
      throw new ForbiddenException(
        'Solo quien acompaña a un paciente puede mandarle un recordatorio',
      );
    }
    if (!guardian.hasJourneyAccess) {
      throw new ConflictException(
        'El paciente ya no comparte su recorrido con vos',
      );
    }

    const message = this.messageRepository.create({
      patientId: guardian.patientId,
      text,
      sentById: currentUserId,
      sentAt: new Date(),
      createdAt: new Date(),
      createdById: currentUserId,
    });
    await this.messageRepository.save(message);
    return this.buildGrantedResponse(
      guardian.patientId,
      'GUARDIAN',
      RELATIONSHIP_LABELS[guardian.relationshipType],
    );
  }

  async setGuardianAccess(
    hasAccess: boolean,
    currentUserId: number,
  ): Promise<JourneyAccessResponseDto> {
    const patient = await this.getOwnedPatientOrFail(currentUserId);
    const guardian = await this.guardianRepository.findOne({
      where: { patientId: patient.id, isActive: true, isPrimary: true },
    });
    const target =
      guardian ??
      (await this.guardianRepository.findOne({
        where: { patientId: patient.id, isActive: true },
      }));
    if (target) {
      target.hasJourneyAccess = hasAccess;
      target.updatedAt = new Date();
      target.updatedById = currentUserId;
      await this.guardianRepository.save(target);
    }
    return this.buildGrantedResponse(patient.id, 'OWNER', 'Tú');
  }

  async dismissMessage(
    messageId: number,
    currentUserId: number,
  ): Promise<JourneyAccessResponseDto> {
    const patient = await this.getOwnedPatientOrFail(currentUserId);
    const message = await this.messageRepository.findOne({
      where: { id: messageId, patientId: patient.id },
    });
    if (message) {
      message.deletedAt = new Date();
      message.deletedById = currentUserId;
      await this.messageRepository.save(message);
    }
    return this.buildGrantedResponse(patient.id, 'OWNER', 'Tú');
  }

  private buildViewer(
    role: 'OWNER' | 'GUARDIAN',
    relationship: string,
  ): JourneyAccessResponseDto['viewer'] {
    return {
      role,
      relationship,
      canEditChecklist: role === 'OWNER',
      canSendReminder: role === 'GUARDIAN',
      canManageGuardianAccess: role === 'OWNER',
      canReportAppointment: role === 'OWNER',
      canManageConsultationCode: role === 'OWNER',
    };
  }

  private async buildGrantedResponse(
    patientId: number,
    role: 'OWNER' | 'GUARDIAN',
    relationship: string,
  ): Promise<JourneyAccessResponseDto> {
    const [
      detail,
      transition,
      checklist,
      medications,
      allergies,
      contacts,
      guide,
      guardian,
      pendingMessage,
    ] = await Promise.all([
      this.patientTransitionService.findDetail(patientId),
      this.transitionRepository.findOne({ where: { patientId } }),
      this.checklistRepository.find({
        where: { patientId },
        order: { displayOrder: 'ASC' },
      }),
      this.medicationRepository.find({
        where: { patientId },
        order: { displayOrder: 'ASC' },
      }),
      this.allergyRepository.find({
        where: { patientId },
        order: { displayOrder: 'ASC' },
      }),
      this.contactRepository.find({
        where: { patientId },
        order: { displayOrder: 'ASC' },
      }),
      this.guideRepository.find({
        where: { state: true },
        order: { displayOrder: 'ASC' },
      }),
      this.guardianRepository.findOne({
        where: { patientId, isActive: true, isPrimary: true },
      }),
      this.messageRepository.findOne({
        where: { patientId, deletedAt: IsNull() },
        order: { sentAt: 'DESC' },
      }),
    ]);

    const guardianAny =
      guardian ??
      (await this.guardianRepository.findOne({
        where: { patientId, isActive: true },
      }));
    const guardianRelationship = guardianAny
      ? RELATIONSHIP_LABELS[guardianAny.relationshipType]
      : null;
    const guardianDto = guardianAny
      ? {
          firstName:
            (
              await this.userRepository.findOne({
                where: { id: guardianAny.userId },
              })
            )?.firstName ?? '',
          relationship: guardianRelationship as string,
          hasAccess: guardianAny.hasJourneyAccess,
        }
      : null;

    return {
      access: 'GRANTED',
      viewer: this.buildViewer(role, relationship),
      journey: {
        patientId,
        initials:
          `${detail.firstName.charAt(0)}${detail.lastName.charAt(0)}`.toUpperCase(),
        age: detail.age,
        state: detail.state,
        diagnosis: detail.primaryDiagnosis ?? '',
        // Sin un generador de lenguaje llano todavía (ver sección 3 del
        // .md sobre la generación server-side de la historia clínica) —
        // por ahora el mismo texto técnico hace de placeholder; queda
        // documentado como simplificación deliberada del prototipo.
        diagnosisPlain: detail.primaryDiagnosis ?? '',
        followUp: detail.specialtyName
          ? `Seguimiento en ${detail.specialtyName}`
          : '',
        attendingDoctor: detail.attendingDoctor ?? 'Por asignar',
        specialty: detail.specialtyName,
        medications: medications.map((m) => ({
          initial: m.initial,
          name: m.name,
          dose: m.dose,
          purpose: m.purpose,
        })),
        allergies: allergies.map((a) => ({
          substance: a.substance,
          detail: a.detail,
        })),
        contacts: contacts.map((c) => ({
          role: c.role,
          name: c.name,
          detail: c.detail,
        })),
        checklist: checklist.map((c) => ({
          id: String(c.id),
          title: c.title,
          detail: c.detail,
          pendingLabel: c.pendingLabel,
          done: c.done,
        })),
        guide: guide.map((g) => ({ question: g.question, answer: g.answer })),
        healthPost: detail.healthPost,
        appointment: detail.appointment,
        appointmentAddress: transition?.appointmentAddress ?? null,
        arriveMinutesEarly: transition?.arriveMinutesEarly ?? 0,
        admissionNote: transition?.admissionNote ?? null,
        summaryApproved:
          detail.summaryStatus === ClinicalSummaryStatus.APPROVED,
        referralReviewStatus: detail.referralReviewStatus,
        // Quién la aceptó, para poder nombrarlo. El destino es el hospital
        // de adultos al que lo derivó la posta; si la posta todavía no
        // redactó esa derivación, el destino visible es la posta misma.
        // null salvo aceptada: nombrar a quien todavía no contestó (o a
        // quien la rechazó) sería decirle a la persona algo que no pasó.
        referralAcceptedBy:
          detail.referralReviewStatus === ReferralReviewStatus.ACCEPTED
            ? (detail.hospitalReferral?.hospital ??
              detail.healthPost?.name ??
              null)
            : null,
        guardian: guardianDto,
        pendingMessage: pendingMessage
          ? {
              id: String(pendingMessage.id),
              text: pendingMessage.text,
              sentAt: pendingMessage.sentAt.toISOString(),
              from: guardianRelationship
                ? `tu ${guardianRelationship}`
                : 'tu tutor',
            }
          : null,
        // Vencido, se muestra como si nunca se hubiera generado: el
        // paciente lo ve desaparecer solo la próxima vez que recarga
        // su recorrido, sin que nadie tenga que "limpiarlo" en la base.
        consultationCode:
          transition &&
          this.patientTransitionService.isConsultationCodeValid(transition)
            ? transition.consultationCode
            : null,
        consultationCodeExpiresAt:
          transition &&
          this.patientTransitionService.isConsultationCodeValid(transition)
            ? this.patientTransitionService
                .consultationCodeExpiresAt(transition)!
                .toISOString()
            : null,
      },
    };
  }

  /**
   * El paciente encontró su cita por su cuenta, sin esperar a que la
   * posta se la consiga — 409 si ya había una (evita pisar en silencio
   * la que sí gestionó la posta) y 409 también si su referencia todavía
   * no está aceptada: el hospital de adultos no da fecha sin ella, así que
   * una cita registrada antes sería una fecha que no existe.
   *
   * El candado del formulario en la app es la misma regla dicha antes de
   * tiempo, no la autorización: esconder un botón no autoriza nada
   * (OWASP A01), y esta es la comprobación que de verdad cuenta.
   */
  async reportAppointment(
    dto: ReportAppointmentDto,
    currentUserId: number,
  ): Promise<JourneyAccessResponseDto> {
    const patient = await this.getOwnedPatientOrFail(currentUserId);
    const transition = await this.transitionRepository.findOne({
      where: { patientId: patient.id },
    });
    if (!transition) {
      throw new NotFoundException('No hay un registro de transición para vos');
    }
    if (transition.appointment) {
      throw new ConflictException('Ya tienes una cita registrada');
    }
    const detail = await this.patientTransitionService.findDetail(patient.id);
    if (detail.referralReviewStatus !== ReferralReviewStatus.ACCEPTED) {
      throw new ConflictException(
        'Es necesaria la referencia aceptada para agendar una cita',
      );
    }

    const appointment: AppointmentDetails = {
      hospital: dto.hospital,
      specialist: dto.doctor,
      date: `${dto.date}T${dto.time}:00`,
      reason: 'Primera consulta en el hospital de adultos',
      managedBy: 'Autoregistrada por el paciente',
    };
    transition.appointment = appointment;
    if (!BEYOND_FIRST_APPOINTMENT.has(transition.state)) {
      transition.state = TransitionState.APPOINTMENT_GRANTED;
    }
    transition.updatedAt = new Date();
    transition.updatedById = currentUserId;
    await this.transitionRepository.save(transition);

    return this.buildGrantedResponse(patient.id, 'OWNER', 'Tú');
  }

  /**
   * Genera (o regenera) el código único de consulta. Regenerar invalida el
   * anterior sin avisar a nadie más: no hay ningún tercero con ese código
   * guardado todavía, es el paciente mostrándolo recién en el momento.
   */
  async generateConsultationCode(
    currentUserId: number,
  ): Promise<JourneyAccessResponseDto> {
    const patient = await this.getOwnedPatientOrFail(currentUserId);
    const transition = await this.transitionRepository.findOne({
      where: { patientId: patient.id },
    });
    if (!transition) {
      throw new NotFoundException('No hay un registro de transición para vos');
    }

    transition.consultationCode = await this.generateUniqueCode();
    transition.consultationCodeGeneratedAt = new Date();
    transition.updatedAt = new Date();
    transition.updatedById = currentUserId;
    await this.transitionRepository.save(transition);

    return this.buildGrantedResponse(patient.id, 'OWNER', 'Tú');
  }

  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const candidate = this.randomCode();
      const clash = await this.transitionRepository.findOne({
        where: { consultationCode: candidate },
      });
      if (!clash) {
        return candidate;
      }
    }
    // Con 32^8 combinaciones posibles, agotar los intentos es
    // prácticamente imposible salvo un bug — mejor un 500 explícito que
    // devolver un código que podría no ser único.
    throw new ConflictException(
      'No se pudo generar un código único, intenta de nuevo',
    );
  }

  private randomCode(): string {
    const bytes = randomBytes(CODE_LENGTH);
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    }
    return code;
  }

  private async getOwnedPatientOrFail(currentUserId: number): Promise<Patient> {
    const patient = await this.patientRepository.findOne({
      where: { userId: currentUserId },
    });
    if (!patient) {
      throw new ForbiddenException(
        'Esta acción es solo para el paciente titular',
      );
    }
    return patient;
  }

  private async getPatientOrFail(id: number): Promise<Patient> {
    const patient = await this.patientRepository.findOne({ where: { id } });
    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }
    return patient;
  }

  private initialsOf(patient: Patient): string {
    return `${patient.firstName.charAt(0)}${patient.lastName.charAt(0)}`.toUpperCase();
  }
}
