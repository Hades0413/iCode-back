import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PatientTransition } from '../../../domain/entities/patients/patient-transition.entity';
import { Patient } from '../../../domain/entities/patients/patient.entity';
import { MedicalSpecialty } from '../../../domain/entities/facilities/medical-specialty.entity';
import { HealthFacilityStaff } from '../../../domain/entities/facilities/health-facility-staff.entity';
import { HealthFacilityStaffSpecialty } from '../../../domain/entities/facilities/health-facility-staff-specialty.entity';
import { HealthFacility } from '../../../domain/entities/facilities/health-facility.entity';
import { TransitionSummary } from '../../../domain/entities/clinical/transition-summary.entity';
import { PostNotice } from '../../../domain/entities/referrals/post-notice.entity';
import { ReferralAlert } from '../../../domain/entities/referrals/referral-alert.entity';
import { CounterReferral } from '../../../domain/entities/referrals/counter-referral.entity';
import { JourneyChecklistItem } from '../../../domain/entities/journey/journey-checklist-item.entity';
import { User } from '../../../domain/entities/user.entity';
import { TransitionState } from '../../../domain/enums/transition-state.enum';
import { CounterReferralStatus } from '../../../domain/enums/counter-referral-status.enum';
import * as ageUtil from '../../../common/utils/age.util';
import { calculateSummaryProgress } from './summary-progress.calculator';
import { CreatePatientTransitionDto } from '../../dto/transition/create-patient-transition.dto';
import { UpdatePatientTransitionDto } from '../../dto/transition/update-patient-transition.dto';
import { PatientTransitionResponseDto } from '../../dto/transition/patient-transition-response.dto';

interface LastActionCandidate {
  at: Date;
  label: string;
}

/**
 * Corta a propósito: se dicta en la consulta, no se copia y pega — ver
 * JourneyService.generateConsultationCode. Vencido, "generas otro y ya"
 * (no hay forma de extenderlo, es más simple que el paciente lo
 * regenere que mantener un estado "renovado").
 */
export const CONSULTATION_CODE_TTL_MINUTES = 15;

/**
 * Dueño de "PatientTransition" — el tablero del especialista
 * (in-tutelage), el panel post-transición (post-transition) y las
 * columnas calculadas que ambos comparten. Referral/CounterReferral/
 * TransitionSummary lo importan a ÉL (para "setState" y
 * "assertSpecialtyMatches"), nunca al revés — ver
 * PUENTE18_FRONTEND_INTEGRATION.md, sección 2.
 *
 * Lee (no escribe) las tablas de esos tres módulos solo para armar
 * "lastAction"/"summaryStatus" en la fila — mismo criterio que
 * "ConsentModule" leyendo "Patient" vía forFeature sin depender del
 * servicio que lo escribe.
 */
@Injectable()
export class PatientTransitionService {
  constructor(
    @InjectRepository(PatientTransition)
    private readonly transitionRepository: Repository<PatientTransition>,
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    @InjectRepository(MedicalSpecialty)
    private readonly specialtyRepository: Repository<MedicalSpecialty>,
    @InjectRepository(HealthFacilityStaff)
    private readonly staffRepository: Repository<HealthFacilityStaff>,
    @InjectRepository(HealthFacilityStaffSpecialty)
    private readonly staffSpecialtyRepository: Repository<HealthFacilityStaffSpecialty>,
    @InjectRepository(HealthFacility)
    private readonly facilityRepository: Repository<HealthFacility>,
    @InjectRepository(TransitionSummary)
    private readonly summaryRepository: Repository<TransitionSummary>,
    @InjectRepository(PostNotice)
    private readonly postNoticeRepository: Repository<PostNotice>,
    @InjectRepository(ReferralAlert)
    private readonly referralAlertRepository: Repository<ReferralAlert>,
    @InjectRepository(CounterReferral)
    private readonly counterReferralRepository: Repository<CounterReferral>,
    @InjectRepository(JourneyChecklistItem)
    private readonly checklistRepository: Repository<JourneyChecklistItem>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(
    dto: CreatePatientTransitionDto,
    currentUserId: number,
  ): Promise<PatientTransitionResponseDto> {
    const patient = await this.patientRepository.findOne({
      where: { id: dto.patientId },
    });
    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }
    const existing = await this.transitionRepository.findOne({
      where: { patientId: dto.patientId },
    });
    if (existing) {
      throw new ConflictException(
        'Este paciente ya tiene un registro de transición',
      );
    }

    const transition = this.transitionRepository.create({
      patientId: dto.patientId,
      state: TransitionState.PENDING,
      medicalRecordNumber: dto.medicalRecordNumber,
      primaryDiagnosis: dto.primaryDiagnosis ?? null,
      specialtyId: dto.specialtyId,
      attendingStaffId: dto.attendingStaffId ?? null,
      district: dto.district ?? null,
      healthPostFacilityId: null,
      healthPostDistanceKm: null,
      referredToPostAt: null,
      hospitalReferral: null,
      appointment: null,
      counterReferralStatus: 'NONE',
      createdAt: new Date(),
      createdById: currentUserId,
    });
    const saved = await this.transitionRepository.save(transition);
    const [dtoResult] = await this.buildResponses([saved], [patient]);
    return dtoResult;
  }

  async findDetail(patientId: number): Promise<PatientTransitionResponseDto> {
    const transition = await this.getTransitionOrFail(patientId);
    const patient = await this.getPatientOrFail(patientId);
    const [result] = await this.buildResponses([transition], [patient]);
    return result;
  }

  /** GET /patient-transitions/in-tutelage — recortado por especialidad del médico logueado, siempre en el servidor. */
  async findInTutelage(
    currentUserId: number,
  ): Promise<PatientTransitionResponseDto[]> {
    const specialtyIds = await this.getSpecialtyIdsForUser(currentUserId);

    const qb = this.transitionRepository
      .createQueryBuilder('t')
      .innerJoin(Patient, 'p', 'p."Id" = t."PatientId"')
      .where('p."DateOfBirth" > :cutoff', {
        cutoff: this.eighteenYearsAgo(),
      });
    if (specialtyIds !== null) {
      if (specialtyIds.length === 0) {
        return [];
      }
      qb.andWhere('t."SpecialtyId" IN (:...specialtyIds)', { specialtyIds });
    }
    const transitions = await qb.getMany();
    return this.buildResponses(transitions);
  }

  /**
   * Todos los pacientes en tutela, SIN recorte por especialidad — para
   * las bandejas del área de Referencias y Contrarreferencias, que no
   * son la cohorte de un médico puntual (ver ReferralService).
   */
  async findAllInTutelage(): Promise<PatientTransitionResponseDto[]> {
    const transitions = await this.transitionRepository
      .createQueryBuilder('t')
      .innerJoin(Patient, 'p', 'p."Id" = t."PatientId"')
      .where('p."DateOfBirth" > :cutoff', { cutoff: this.eighteenYearsAgo() })
      .getMany();
    return this.buildResponses(transitions);
  }

  /** GET /patient-transitions/post-transition — panel de seguimiento, sin recorte por especialidad (visibilidad de supervisión, no de casilla personal). */
  async findPostTransition(): Promise<PatientTransitionResponseDto[]> {
    const transitions = await this.transitionRepository
      .createQueryBuilder('t')
      .innerJoin(Patient, 'p', 'p."Id" = t."PatientId"')
      .where('p."DateOfBirth" <= :cutoff', {
        cutoff: this.eighteenYearsAgo(),
      })
      .getMany();
    return this.buildResponses(transitions);
  }

  async update(
    patientId: number,
    dto: UpdatePatientTransitionDto,
    currentUserId: number,
  ): Promise<PatientTransitionResponseDto> {
    const transition = await this.getTransitionOrFail(patientId);

    if (dto.primaryDiagnosis !== undefined) {
      transition.primaryDiagnosis = dto.primaryDiagnosis;
    }
    if (dto.specialtyId !== undefined) {
      transition.specialtyId = dto.specialtyId;
    }
    if (dto.attendingStaffId !== undefined) {
      transition.attendingStaffId = dto.attendingStaffId;
    }
    if (dto.district !== undefined) {
      transition.district = dto.district;
    }
    if (dto.healthPostFacilityId !== undefined) {
      transition.healthPostFacilityId = dto.healthPostFacilityId;
    }
    if (dto.healthPostDistanceKm !== undefined) {
      transition.healthPostDistanceKm =
        dto.healthPostDistanceKm === null
          ? null
          : String(dto.healthPostDistanceKm);
    }
    if (dto.hospitalReferral !== undefined) {
      transition.hospitalReferral = {
        hospital: dto.hospitalReferral.hospital,
        specialty: dto.hospitalReferral.specialty,
        doctor: dto.hospitalReferral.doctor ?? null,
        referredAt: dto.hospitalReferral.referredAt,
      };
    }
    if (dto.appointment !== undefined) {
      transition.appointment = dto.appointment;
      if (transition.state === TransitionState.APPOINTMENT_IN_PROCESS) {
        transition.state = TransitionState.APPOINTMENT_GRANTED;
      }
    }
    transition.updatedAt = new Date();
    transition.updatedById = currentUserId;
    const saved = await this.transitionRepository.save(transition);
    const [result] = await this.buildResponses([saved]);
    return result;
  }

  /**
   * Lo llaman ReferralService (al avisar a la posta) y otros servicios
   * de este dominio — nunca lo elige el cliente directamente.
   */
  async setState(
    patientId: number,
    state: TransitionState,
    currentUserId: number,
  ): Promise<void> {
    await this.transitionRepository.update(
      { patientId },
      { state, updatedAt: new Date(), updatedById: currentUserId },
    );
  }

  async setCounterReferralStatus(
    patientId: number,
    status: CounterReferralStatus | 'NONE',
    currentUserId: number,
  ): Promise<void> {
    // ".update()" con un tipo unión ("CounterReferralStatus | 'NONE'") en
    // el partial confunde el mapeo de tipos de TypeORM — se busca y se
    // guarda la entidad completa en vez de forzar un "as any".
    const transition = await this.getTransitionOrFail(patientId);
    transition.counterReferralStatus = status;
    transition.updatedAt = new Date();
    transition.updatedById = currentUserId;
    await this.transitionRepository.save(transition);
  }

  async setReferredToPost(
    patientId: number,
    referredAt: Date,
    currentUserId: number,
  ): Promise<void> {
    await this.transitionRepository.update(
      { patientId },
      {
        state: TransitionState.REFERRED_TO_POST,
        referredToPostAt: referredAt,
        updatedAt: new Date(),
        updatedById: currentUserId,
      },
    );
  }

  /**
   * Contexto liviano para que otros servicios de este dominio (generar
   * el resumen, avisar a la posta, subir la carta) evalúen sus reglas
   * sin pagar el costo de "findDetail" (que arma toda la fila de la UI,
   * incluida la agregación de "lastAction"). Nunca se expone tal cual
   * por un endpoint — es para consumo entre servicios.
   */
  async getRuleContext(patientId: number): Promise<{
    patientId: number;
    state: TransitionState;
    specialtyId: number;
    monthsToEighteen: number;
    isAdult: boolean;
    counterReferralStatus: 'NONE' | 'UPLOADED' | 'SENT';
    referredToPostAt: Date | null;
    healthPostFacilityId: number | null;
  }> {
    const transition = await this.getTransitionOrFail(patientId);
    const patient = await this.getPatientOrFail(patientId);
    return {
      patientId,
      state: transition.state,
      specialtyId: transition.specialtyId,
      monthsToEighteen: ageUtil.monthsToEighteen(patient.dateOfBirth),
      isAdult: ageUtil.isAdult(patient.dateOfBirth),
      counterReferralStatus: transition.counterReferralStatus,
      referredToPostAt: transition.referredToPostAt,
      healthPostFacilityId: transition.healthPostFacilityId,
    };
  }

  /**
   * Resuelve el código único de consulta (ver JourneyService.generateConsultationCode)
   * al paciente dueño — lo usa TransitionSummariesController para que un
   * médico vea el resumen sin conocer el "patientId". 404 igual si el
   * código existe pero ya venció: para quien lo escanea o lo tipea es
   * indistinguible de uno que nunca existió.
   */
  async findPatientIdByConsultationCode(code: string): Promise<number> {
    const transition = await this.transitionRepository.findOne({
      where: { consultationCode: code },
    });
    if (!transition || !this.isConsultationCodeValid(transition)) {
      throw new NotFoundException('Código de consulta no válido o vencido');
    }
    return transition.patientId;
  }

  /**
   * Vencimiento calculado siempre desde "ConsultationCodeGeneratedAt",
   * nunca guardado — mismo criterio que "isAdult"/"monthsToEighteen"
   * (ver TitleTransferService): una columna de vencimiento se puede
   * desincronizar, una cuenta no.
   */
  isConsultationCodeValid(transition: PatientTransition): boolean {
    if (!transition.consultationCode || !transition.consultationCodeGeneratedAt) {
      return false;
    }
    return this.consultationCodeExpiresAt(transition)!.getTime() > Date.now();
  }

  /** null si nunca se generó ningún código. */
  consultationCodeExpiresAt(transition: PatientTransition): Date | null {
    if (!transition.consultationCodeGeneratedAt) {
      return null;
    }
    return new Date(
      transition.consultationCodeGeneratedAt.getTime() +
        CONSULTATION_CODE_TTL_MINUTES * 60_000,
    );
  }

  async getTransitionOrFail(patientId: number): Promise<PatientTransition> {
    const transition = await this.transitionRepository.findOne({
      where: { patientId },
    });
    if (!transition) {
      throw new NotFoundException(
        'Este paciente no tiene un registro de transición',
      );
    }
    return transition;
  }

  /**
   * Defensa en profundidad, igual que "PatientService.assertIsCurrentTitleholder":
   * el permiso PATIENT_WRITE solo dice que el usuario puede escribir en
   * general, no que este paciente sea de SU especialidad — eso se valida
   * acá, a nivel de servicio (el guard de permisos es ciego a filas).
   */
  async assertSpecialtyMatches(
    patientId: number,
    userId: number,
  ): Promise<void> {
    const transition = await this.getTransitionOrFail(patientId);
    const specialtyIds = await this.getSpecialtyIdsForUser(userId);
    if (specialtyIds === null) {
      return; // sin staff asociado -> sin restricción (ej. admin/supervisión)
    }
    if (!specialtyIds.includes(transition.specialtyId)) {
      throw new ForbiddenException('Ese paciente no es de tu especialidad');
    }
  }

  /** null = sin restricción (el usuario no es personal de salud con especialidad asignada). */
  private async getSpecialtyIdsForUser(
    userId: number,
  ): Promise<number[] | null> {
    const staff = await this.staffRepository.findOne({ where: { userId } });
    if (!staff) {
      return null;
    }
    const links = await this.staffSpecialtyRepository.find({
      where: { healthFacilityStaffId: staff.id },
    });
    return links.map((l) => l.medicalSpecialtyId);
  }

  private async getPatientOrFail(id: number): Promise<Patient> {
    const patient = await this.patientRepository.findOne({ where: { id } });
    if (!patient) {
      throw new NotFoundException('Paciente no encontrado');
    }
    return patient;
  }

  private computeLastAction(
    notices: PostNotice[],
    alerts: ReferralAlert[],
    summary: TransitionSummary | undefined,
    counterReferral: CounterReferral | undefined,
  ): string | null {
    const candidates: LastActionCandidate[] = [
      ...notices.map((n) => ({
        at: n.sentAt,
        label: 'Aviso a la posta enviado',
      })),
      ...alerts.map((a) => ({
        at: a.sentAt,
        label: 'Reclamo al área enviado',
      })),
    ];
    if (summary) {
      candidates.push(this.summaryLastActionCandidate(summary));
    }
    if (counterReferral) {
      candidates.push(this.counterReferralLastActionCandidate(counterReferral));
    }
    if (candidates.length === 0) {
      return null;
    }
    return candidates.reduce(
      (latest, c) => (c.at > latest.at ? c : latest),
      candidates[0],
    ).label;
  }

  private summaryLastActionCandidate(
    summary: TransitionSummary,
  ): LastActionCandidate {
    if (summary.approvedAt) {
      return { at: summary.approvedAt, label: 'Historia clínica firmada' };
    }
    if (summary.editedAt) {
      return { at: summary.editedAt, label: 'Borrador editado' };
    }
    return { at: summary.draftedAt, label: 'Borrador generado' };
  }

  private counterReferralLastActionCandidate(
    counterReferral: CounterReferral,
  ): LastActionCandidate {
    if (counterReferral.sentAt) {
      return {
        at: counterReferral.sentAt,
        label: 'Carta de contrarreferencia enviada',
      };
    }
    return {
      at: counterReferral.uploadedAt,
      label: 'Carta de contrarreferencia subida',
    };
  }

  private computeDaysWaitingOnPost(t: PatientTransition): number | null {
    const isWaiting =
      t.state === TransitionState.REFERRED_TO_POST ||
      t.state === TransitionState.APPOINTMENT_IN_PROCESS;
    if (!isWaiting || !t.referredToPostAt) {
      return null;
    }
    return Math.floor(
      (Date.now() - t.referredToPostAt.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  private eighteenYearsAgo(): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().slice(0, 10);
  }

  private async buildResponses(
    transitions: PatientTransition[],
    patientsHint?: Patient[],
  ): Promise<PatientTransitionResponseDto[]> {
    if (transitions.length === 0) {
      return [];
    }
    const patientIds = transitions.map((t) => t.patientId);
    const specialtyIds = [...new Set(transitions.map((t) => t.specialtyId))];
    const facilityIds = [
      ...new Set(
        transitions
          .map((t) => t.healthPostFacilityId)
          .filter((id): id is number => id !== null),
      ),
    ];

    const patients =
      patientsHint ??
      (await this.patientRepository.find({ where: { id: In(patientIds) } }));
    const specialties = await this.specialtyRepository.find({
      where: { id: In(specialtyIds) },
    });
    const facilities =
      facilityIds.length > 0
        ? await this.facilityRepository.find({ where: { id: In(facilityIds) } })
        : [];

    const [
      summaries,
      postNotices,
      referralAlerts,
      counterReferrals,
      checklistItems,
    ] = await Promise.all([
      this.summaryRepository.find({ where: { patientId: In(patientIds) } }),
      this.postNoticeRepository.find({
        where: { patientId: In(patientIds) },
      }),
      this.referralAlertRepository.find({
        where: { patientId: In(patientIds) },
      }),
      this.counterReferralRepository.find({
        where: { patientId: In(patientIds) },
      }),
      this.checklistRepository.find({
        where: { patientId: In(patientIds) },
      }),
    ]);

    const attendingStaffIds = [
      ...new Set(
        transitions
          .map((t) => t.attendingStaffId)
          .filter((id): id is number => id !== null),
      ),
    ];
    const attendingStaff =
      attendingStaffIds.length > 0
        ? await this.staffRepository.find({
            where: { id: In(attendingStaffIds) },
          })
        : [];
    const staffUserIdByStaffId = new Map(
      attendingStaff.map((s) => [s.id, s.userId]),
    );

    // Todos los "quién" que hay que resolver a un nombre en esta tanda:
    // el médico a cargo (vía su fila de staff) y quien mandó cada aviso
    // o reclamo — el front los quiere como texto, no como id (ver
    // PUENTE18_FRONTEND_INTEGRATION.md, sección 2, "reconciliación con
    // el contrato real del front").
    const userIdsToResolve = [
      ...new Set(
        [
          ...attendingStaff.map((s) => s.userId),
          ...postNotices.map((n) => n.sentById),
          ...referralAlerts.map((a) => a.sentById),
        ].filter((id): id is number => id !== undefined && id !== null),
      ),
    ];
    const users =
      userIdsToResolve.length > 0
        ? await this.userRepository.find({
            where: { id: In(userIdsToResolve) },
          })
        : [];
    const userNameById = new Map(
      users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]),
    );

    const patientById = new Map(patients.map((p) => [p.id, p]));
    const specialtyById = new Map(specialties.map((s) => [s.id, s]));
    const facilityById = new Map(facilities.map((f) => [f.id, f]));

    return transitions.map((t) => {
      const patient = patientById.get(t.patientId);
      if (!patient) {
        throw new NotFoundException(
          `Paciente ${t.patientId} no encontrado para su registro de transición`,
        );
      }
      const specialty = specialtyById.get(t.specialtyId);
      const healthPost = t.healthPostFacilityId
        ? facilityById.get(t.healthPostFacilityId)
        : undefined;
      const summary = summaries.find((s) => s.patientId === t.patientId);
      const counterReferral = counterReferrals.find(
        (c) => c.patientId === t.patientId,
      );
      const noticesForPatient = postNotices.filter(
        (n) => n.patientId === t.patientId,
      );
      const alertsForPatient = referralAlerts.filter(
        (a) => a.patientId === t.patientId,
      );
      const lastAction = this.computeLastAction(
        noticesForPatient,
        alertsForPatient,
        summary,
        counterReferral,
      );
      const daysWaitingOnPost = this.computeDaysWaitingOnPost(t);
      const isAdult = ageUtil.isAdult(patient.dateOfBirth);
      const specialtyName =
        (isAdult ? specialty?.adultName : null) ?? specialty?.name ?? '';
      const attendingStaffUserId = t.attendingStaffId
        ? staffUserIdByStaffId.get(t.attendingStaffId)
        : undefined;
      const attendingDoctor =
        attendingStaffUserId !== undefined
          ? (userNameById.get(attendingStaffUserId) ?? null)
          : null;
      const itemsForPatient = checklistItems.filter(
        (c) => c.patientId === t.patientId,
      );
      const checklistProgress =
        itemsForPatient.length === 0
          ? null
          : itemsForPatient.filter((c) => c.done).length /
            itemsForPatient.length;

      return {
        // "id" es la forma en la que el front trata la identidad del
        // paciente (string opaco, ver domain/entities/patient.entity.ts
        // de iCode-front) — "patientId" sigue existiendo tal cual para
        // el resto de los servicios de este backend.
        id: String(t.patientId),
        patientId: t.patientId,
        documentNumber: patient.documentNumber,
        dni: patient.documentNumber,
        firstName: patient.firstName,
        lastName: patient.lastName,
        initials:
          `${patient.firstName.charAt(0)}${patient.lastName.charAt(0)}`.toUpperCase(),
        sex: patient.sex,
        medicalRecordNumber: t.medicalRecordNumber,
        medicalRecord: t.medicalRecordNumber,
        primaryDiagnosis: t.primaryDiagnosis,
        diagnosis: t.primaryDiagnosis ?? '',
        age: ageUtil.formatAge(patient.dateOfBirth),
        monthsToEighteen: ageUtil.monthsToEighteen(patient.dateOfBirth),
        turnedEighteenAt: ageUtil.turnedEighteenAt(patient.dateOfBirth),
        isAdult,
        specialtyId: t.specialtyId,
        // Ya cumplidos los 18, la etiqueta pasa a la variante "de
        // adultos" del catálogo (ver medical-specialty.entity.ts) — nunca
        // se reasigna "SpecialtyId", solo cambia el nombre mostrado.
        specialtyName,
        specialty: specialtyName,
        attendingStaffId: t.attendingStaffId,
        attendingDoctor,
        district: t.district,
        state: t.state,
        summaryStatus: summary?.status ?? 'NONE',
        summaryProgress: summary
          ? calculateSummaryProgress(summary.sections, summary.status)
          : 0,
        healthPost: healthPost
          ? {
              id: String(healthPost.id),
              name: healthPost.name,
              district: healthPost.district ?? '',
              distanceKm:
                t.healthPostDistanceKm !== null
                  ? Number(t.healthPostDistanceKm)
                  : 0,
            }
          : null,
        referredToPostAt: t.referredToPostAt
          ? t.referredToPostAt.toISOString()
          : null,
        daysWaitingOnPost,
        hospitalReferral: t.hospitalReferral,
        appointment: t.appointment,
        counterReferralStatus: t.counterReferralStatus,
        // El front lo declara "string" siempre (no nullable) — sin
        // ningún evento todavía, es un caso recién dado de alta.
        lastAction: lastAction ?? 'Sin actividad registrada todavía',
        checklistProgress,
        postNotices: noticesForPatient.map((n) => ({
          sentAt: n.sentAt.toISOString(),
          sentById: n.sentById,
          sentBy: userNameById.get(n.sentById) ?? '',
        })),
        referralAlerts: alertsForPatient.map((a) => ({
          sentAt: a.sentAt.toISOString(),
          sentById: a.sentById,
          sentBy: userNameById.get(a.sentById) ?? '',
          reason: a.reason,
        })),
      };
    });
  }
}
