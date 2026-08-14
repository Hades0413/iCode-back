import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TransitionSummary } from '../../../domain/entities/clinical/transition-summary.entity';
import { User } from '../../../domain/entities/user.entity';
import { ClinicalSummaryStatus } from '../../../domain/enums/clinical-summary-status.enum';
import { SummaryAuthorKind } from '../../../domain/enums/summary-author-kind.enum';
import { TransitionState } from '../../../domain/enums/transition-state.enum';
import { PatientTransitionService } from '../transition/patient-transition.service';
import { UpdateTransitionSummaryDto } from '../../dto/clinical/update-transition-summary.dto';
import {
  ClinicalSummaryResultDto,
  TransitionSummaryResponseDto,
} from '../../dto/clinical/transition-summary-response.dto';

/** Habilitado desde 3 meses antes de los 18 — ver PUENTE18_FRONTEND_INTEGRATION.md, sección 3. */
const ENABLE_MONTHS_BEFORE_18 = 3;
/** La firma solo se puede hacer en el último mes antes del cumpleaños (o después, si por algo quedó pendiente). */
const SIGN_MONTHS_BEFORE_18 = 1;

const SECTION_TEMPLATE: Array<{ id: string; title: string; hint: string }> = [
  {
    id: 'identificacion',
    title: 'Identificación',
    hint: 'Datos básicos del paciente',
  },
  {
    id: 'diagnostico',
    title: 'Diagnóstico',
    hint: 'Diagnóstico principal y relevantes',
  },
  {
    id: 'tratamiento',
    title: 'Tratamiento',
    hint: 'Medicación y esquema actual',
  },
  { id: 'evolucion', title: 'Evolución', hint: 'Evolución clínica relevante' },
  { id: 'alertas', title: 'Alertas', hint: 'Alergias y alertas clínicas' },
  {
    id: 'plan',
    title: 'Plan',
    hint: 'Plan de continuidad para el hospital de adultos',
  },
];

/**
 * La historia clínica de transferencia ("las 2 hojas") — ver
 * domain/entities/clinical/transition-summary.entity.ts sobre por qué
 * NO se llama "ClinicalSummary". Depende de TransitionModule (para
 * "getRuleContext"/"assertSpecialtyMatches"/"setState"), nunca al revés.
 *
 * El generador de acá es una simulación con plantillas server-side (ver
 * decisión registrada en PUENTE18_FRONTEND_INTEGRATION.md) — nunca corre
 * en el navegador, y el contrato de los 3 endpoints de escritura no
 * cambia el día que esto se reemplace por un LLM real.
 */
@Injectable()
export class TransitionSummaryService {
  constructor(
    @InjectRepository(TransitionSummary)
    private readonly summaryRepository: Repository<TransitionSummary>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly patientTransitionService: PatientTransitionService,
  ) {}

  async findByPatient(
    patientId: number,
  ): Promise<TransitionSummaryResponseDto> {
    const summary = await this.getSummaryOrFail(patientId);
    return this.toResponseDto(summary);
  }

  /**
   * La misma consulta que "findByPatient", resuelta desde el código único
   * que el paciente genera en "Mi recorrido" (ver
   * JourneyService.generateConsultationCode) en vez de un "patientId" —
   * para el médico que lo atiende y no tiene forma de conocer ese id.
   */
  async findByConsultationCode(
    code: string,
  ): Promise<TransitionSummaryResponseDto> {
    const patientId =
      await this.patientTransitionService.findPatientIdByConsultationCode(code);
    return this.findByPatient(patientId);
  }

  async generate(
    patientId: number,
    currentUserId: number,
  ): Promise<ClinicalSummaryResultDto> {
    await this.patientTransitionService.assertSpecialtyMatches(
      patientId,
      currentUserId,
    );
    const context =
      await this.patientTransitionService.getRuleContext(patientId);
    // "canGenerateSummary" del front exige isTransitionEnabled Y
    // isInTutelage — ya cumplidos los 18 la historia la maneja el
    // hospital de adultos, aunque justo entre en la ventana de 3 meses
    // por algún cálculo raro de fecha.
    if (
      context.monthsToEighteen > ENABLE_MONTHS_BEFORE_18 ||
      context.monthsToEighteen <= 0
    ) {
      throw new ConflictException(
        'No corresponde generar la historia clínica de transferencia para este paciente (fuera de la ventana de 3 meses, o ya cumplió 18)',
      );
    }

    const existing = await this.summaryRepository.findOne({
      where: { patientId },
    });
    if (existing) {
      if (existing.status === ClinicalSummaryStatus.APPROVED) {
        throw new ConflictException(
          'La historia clínica de transferencia ya está firmada',
        );
      }
      if (existing.editedAt !== null) {
        throw new ConflictException(
          'El borrador ya fue editado por un médico — regenerarlo pisaría esas correcciones',
        );
      }
      const { sections, pendingChecks } =
        await this.buildTemplateSections(patientId);
      existing.sections = sections;
      existing.pendingChecks = pendingChecks;
      existing.draftedAt = new Date();
      existing.updatedAt = new Date();
      existing.updatedById = currentUserId;
      const saved = await this.summaryRepository.save(existing);
      return this.toResultDto(patientId, saved);
    }

    const { sections, pendingChecks } =
      await this.buildTemplateSections(patientId);
    const summary = this.summaryRepository.create({
      patientId,
      status: ClinicalSummaryStatus.DRAFT,
      sections,
      pendingChecks,
      draftedByKind: SummaryAuthorKind.AI,
      draftedByName: 'Generador de plantillas (servidor)',
      draftedAt: new Date(),
      editedById: null,
      editedAt: null,
      approvedById: null,
      approvedAt: null,
      createdAt: new Date(),
      createdById: currentUserId,
    });
    const saved = await this.summaryRepository.save(summary);

    if (context.state === TransitionState.PENDING) {
      await this.patientTransitionService.setState(
        patientId,
        TransitionState.IN_PREPARATION,
        currentUserId,
      );
    }
    return this.toResultDto(patientId, saved);
  }

  async update(
    patientId: number,
    dto: UpdateTransitionSummaryDto,
    currentUserId: number,
  ): Promise<ClinicalSummaryResultDto> {
    await this.patientTransitionService.assertSpecialtyMatches(
      patientId,
      currentUserId,
    );
    // "canReviewSummary" del front exige DRAFT Y isInTutelage — igual que
    // generate/approve, no se puede seguir corrigiendo un borrador de un
    // paciente que ya cumplió 18.
    const context =
      await this.patientTransitionService.getRuleContext(patientId);
    if (context.monthsToEighteen <= 0) {
      throw new ConflictException(
        'Este paciente ya cumplió 18 — su historia clínica la maneja el hospital de adultos',
      );
    }
    const summary = await this.getSummaryOrFail(patientId);
    if (summary.status !== ClinicalSummaryStatus.DRAFT) {
      throw new ConflictException(
        'Solo se puede editar un borrador — esta historia ya está firmada',
      );
    }

    const knownIds = new Set(summary.sections.map((s) => s.id));
    for (const edit of dto.sections) {
      if (!knownIds.has(edit.id)) {
        throw new ConflictException(
          `La sección "${edit.id}" no existe en este documento`,
        );
      }
    }
    const editsById = new Map(dto.sections.map((e) => [e.id, e.body]));
    summary.sections = summary.sections.map((section) =>
      editsById.has(section.id)
        ? { ...section, body: editsById.get(section.id) as string }
        : section,
    );
    summary.editedById = currentUserId;
    summary.editedAt = new Date();
    summary.updatedAt = new Date();
    summary.updatedById = currentUserId;
    const saved = await this.summaryRepository.save(summary);
    return this.toResultDto(patientId, saved);
  }

  async approve(
    patientId: number,
    currentUserId: number,
  ): Promise<ClinicalSummaryResultDto> {
    await this.patientTransitionService.assertSpecialtyMatches(
      patientId,
      currentUserId,
    );
    const context =
      await this.patientTransitionService.getRuleContext(patientId);
    // "isInSignWindow" del front exige isInTutelage Y monthsToEighteen<=1
    // — ambas, no solo la segunda (ver canApproveSummary).
    if (
      context.monthsToEighteen <= 0 ||
      context.monthsToEighteen > SIGN_MONTHS_BEFORE_18
    ) {
      throw new ConflictException(
        'Todavía no está en la ventana de firma (último mes antes de los 18)',
      );
    }
    const summary = await this.getSummaryOrFail(patientId);
    if (summary.status !== ClinicalSummaryStatus.DRAFT) {
      throw new ConflictException(
        'No hay un borrador pendiente de firma para este paciente',
      );
    }

    summary.status = ClinicalSummaryStatus.APPROVED;
    summary.approvedById = currentUserId;
    summary.approvedAt = new Date();
    summary.updatedAt = new Date();
    summary.updatedById = currentUserId;
    const saved = await this.summaryRepository.save(summary);
    return this.toResultDto(patientId, saved);
  }

  private async getSummaryOrFail(
    patientId: number,
  ): Promise<TransitionSummary> {
    const summary = await this.summaryRepository.findOne({
      where: { patientId },
    });
    if (!summary) {
      throw new NotFoundException(
        'Todavía no se generó una historia clínica de transferencia para este paciente',
      );
    }
    return summary;
  }

  private async buildTemplateSections(patientId: number): Promise<{
    sections: TransitionSummary['sections'];
    pendingChecks: string[];
  }> {
    const detail = await this.patientTransitionService.findDetail(patientId);
    const pendingChecks: string[] = [];
    if (!detail.primaryDiagnosis) {
      pendingChecks.push(
        'Diagnóstico principal no registrado — completar manualmente',
      );
    }

    const body: Record<string, string> = {
      identificacion: `${detail.firstName} ${detail.lastName}, documento ${detail.documentNumber}, historia clínica ${detail.medicalRecordNumber}.`,
      diagnostico: detail.primaryDiagnosis
        ? `Diagnóstico principal: ${detail.primaryDiagnosis} (${detail.specialtyName}).`
        : '',
      tratamiento: '',
      evolucion: '',
      alertas: '',
      plan: `Continuar seguimiento en ${detail.specialtyName} tras la derivación al hospital de adultos.`,
    };

    const sections = SECTION_TEMPLATE.map((s) => ({
      id: s.id,
      title: s.title,
      hint: s.hint,
      body: body[s.id] ?? '',
    }));
    for (const s of sections) {
      if (!s.body) {
        pendingChecks.push(`Sección "${s.title}" sin información suficiente`);
      }
    }
    return { sections, pendingChecks };
  }

  /** Junta el documento con la fila del paciente — ver ClinicalSummaryResultDto sobre por qué van juntos. */
  private async toResultDto(
    patientId: number,
    summary: TransitionSummary,
  ): Promise<ClinicalSummaryResultDto> {
    const [patient, summaryDto] = await Promise.all([
      this.patientTransitionService.findDetail(patientId),
      this.toResponseDto(summary),
    ]);
    return { patient, summary: summaryDto };
  }

  private async toResponseDto(
    summary: TransitionSummary,
  ): Promise<TransitionSummaryResponseDto> {
    const userIds = [summary.editedById, summary.approvedById].filter(
      (id): id is number => id !== null,
    );
    const users =
      userIds.length > 0
        ? await this.userRepository.find({ where: { id: In(userIds) } })
        : [];
    const nameById = new Map(
      users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]),
    );

    return {
      patientId: String(summary.patientId),
      status: summary.status,
      sections: summary.sections,
      pendingChecks: summary.pendingChecks ?? [],
      draftedBy: { kind: summary.draftedByKind, name: summary.draftedByName },
      draftedAt: summary.draftedAt.toISOString(),
      editedBy:
        summary.editedById !== null
          ? (nameById.get(summary.editedById) ?? null)
          : null,
      editedAt: summary.editedAt ? summary.editedAt.toISOString() : null,
      approvedBy:
        summary.approvedById !== null
          ? (nameById.get(summary.approvedById) ?? null)
          : null,
      approvedAt: summary.approvedAt ? summary.approvedAt.toISOString() : null,
    };
  }
}
