import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Patient } from '../../../domain/entities/patients/patient.entity';
import { LegalGuardian } from '../../../domain/entities/patients/legal-guardian.entity';
import { PatientTransition } from '../../../domain/entities/patients/patient-transition.entity';
import { JourneyChecklistItem } from '../../../domain/entities/journey/journey-checklist-item.entity';
import { JourneyMedication } from '../../../domain/entities/journey/journey-medication.entity';
import { JourneyAllergy } from '../../../domain/entities/journey/journey-allergy.entity';
import { JourneyContact } from '../../../domain/entities/journey/journey-contact.entity';
import { JourneyGuideEntry } from '../../../domain/entities/journey/journey-guide-entry.entity';
import { JourneyMessage } from '../../../domain/entities/journey/journey-message.entity';
import { User } from '../../../domain/entities/user.entity';
import { RelationshipType } from '../../../domain/enums/relationship-type.enum';
import { ClinicalSummaryStatus } from '../../../domain/enums/clinical-summary-status.enum';
import { PatientTransitionService } from '../transition/patient-transition.service';
import { JourneyAccessResponseDto } from '../../dto/journey/journey-response.dto';

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
      },
    };
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
