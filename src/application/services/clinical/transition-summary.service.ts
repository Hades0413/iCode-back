import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { extname } from 'node:path';
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
import {
  OpenAiSummaryDraftingService,
  SUMMARY_SECTION_TEMPLATE,
} from './openai-summary-drafting.service';
import { TransitionSummaryStorageService } from './transition-summary-storage.service';

/** Habilitado desde 3 meses antes de los 18 — ver PUENTE18_FRONTEND_INTEGRATION.md, sección 3. */
const ENABLE_MONTHS_BEFORE_18 = 3;
/** La firma solo se puede hacer en el último mes antes del cumpleaños (o después, si por algo quedó pendiente). */
const SIGN_MONTHS_BEFORE_18 = 1;

const MAX_SOURCE_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_SOURCE_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);

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
    private readonly openAiDrafting: OpenAiSummaryDraftingService,
    private readonly summaryStorageService: TransitionSummaryStorageService,
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
      const detail = await this.patientTransitionService.findDetail(patientId);
      const { sections, pendingChecks } =
        await this.openAiDrafting.draft(detail);
      existing.sections = sections;
      existing.pendingChecks = pendingChecks;
      existing.draftedByKind = SummaryAuthorKind.AI;
      existing.draftedByName = `OpenAI (${this.openAiDrafting.modelName()})`;
      existing.draftedAt = new Date();
      existing.sourceFileName = null;
      existing.sourceFileSize = null;
      existing.sourceStoragePath = null;
      existing.updatedAt = new Date();
      existing.updatedById = currentUserId;
      const saved = await this.summaryRepository.save(existing);
      return this.toResultDto(patientId, saved);
    }

    const detail = await this.patientTransitionService.findDetail(patientId);
    const { sections, pendingChecks } = await this.openAiDrafting.draft(detail);
    const summary = this.summaryRepository.create({
      patientId,
      status: ClinicalSummaryStatus.DRAFT,
      sections,
      pendingChecks,
      draftedByKind: SummaryAuthorKind.AI,
      draftedByName: `OpenAI (${this.openAiDrafting.modelName()})`,
      draftedAt: new Date(),
      editedById: null,
      editedAt: null,
      approvedById: null,
      approvedAt: null,
      sourceFileName: null,
      sourceFileSize: null,
      sourceStoragePath: null,
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

  /** "Llenar la plantilla" — arranca un borrador en blanco, a mano, sin IA. */
  async startBlankTemplate(
    patientId: number,
    currentUserId: number,
  ): Promise<ClinicalSummaryResultDto> {
    const existing = await this.assertCanStartNewDraft(
      patientId,
      currentUserId,
    );
    const author = await this.resolveUserName(currentUserId);
    const sections = SUMMARY_SECTION_TEMPLATE.map((s) => ({
      id: s.id,
      title: s.title,
      hint: s.hint,
      body: '',
    }));
    const pendingChecks = sections.map(
      (s) => `Sección "${s.title}" sin información suficiente`,
    );

    const saved = existing
      ? await this.summaryRepository.save(
          Object.assign(existing, {
            sections,
            pendingChecks,
            draftedByKind: SummaryAuthorKind.HUMAN,
            draftedByName: author,
            draftedAt: new Date(),
            sourceFileName: null,
            sourceFileSize: null,
            sourceStoragePath: null,
            updatedAt: new Date(),
            updatedById: currentUserId,
          }),
        )
      : await this.createDraft(
          patientId,
          currentUserId,
          sections,
          pendingChecks,
          author,
          null,
        );
    return this.toResultDto(patientId, saved);
  }

  /** "Subir el documento" — la historia ya viene redactada aparte; solo se adjunta. */
  async uploadSourceDocument(
    patientId: number,
    file: Express.Multer.File,
    currentUserId: number,
  ): Promise<ClinicalSummaryResultDto> {
    this.assertValidSourceFile(file);
    const existing = await this.assertCanStartNewDraft(
      patientId,
      currentUserId,
    );
    const author = await this.resolveUserName(currentUserId);
    const storagePath = await this.summaryStorageService.save(
      patientId,
      file.originalname,
      file.buffer,
    );
    const sections = SUMMARY_SECTION_TEMPLATE.map((s) => ({
      id: s.id,
      title: s.title,
      hint: s.hint,
      body: '',
    }));
    const pendingChecks = [
      'Documento subido — transcribir el contenido a las secciones antes de firmar',
    ];
    const sourceDocument = {
      sourceFileName: file.originalname,
      sourceFileSize: file.size,
      sourceStoragePath: storagePath,
    };

    const saved = existing
      ? await this.summaryRepository.save(
          Object.assign(existing, {
            sections,
            pendingChecks,
            draftedByKind: SummaryAuthorKind.HUMAN,
            draftedByName: author,
            draftedAt: new Date(),
            ...sourceDocument,
            updatedAt: new Date(),
            updatedById: currentUserId,
          }),
        )
      : await this.createDraft(
          patientId,
          currentUserId,
          sections,
          pendingChecks,
          author,
          sourceDocument,
        );
    return this.toResultDto(patientId, saved);
  }

  /** Ventana + conflictos comunes a los 3 puntos de partida del borrador (IA, plantilla, subida). */
  private async assertCanStartNewDraft(
    patientId: number,
    currentUserId: number,
  ): Promise<TransitionSummary | null> {
    await this.patientTransitionService.assertSpecialtyMatches(
      patientId,
      currentUserId,
    );
    const context =
      await this.patientTransitionService.getRuleContext(patientId);
    if (
      context.monthsToEighteen > ENABLE_MONTHS_BEFORE_18 ||
      context.monthsToEighteen <= 0
    ) {
      throw new ConflictException(
        'No corresponde iniciar la historia clínica de transferencia para este paciente (fuera de la ventana de 3 meses, o ya cumplió 18)',
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
          'El borrador ya fue editado por un médico — reiniciarlo pisaría esas correcciones',
        );
      }
    } else if (context.state === TransitionState.PENDING) {
      await this.patientTransitionService.setState(
        patientId,
        TransitionState.IN_PREPARATION,
        currentUserId,
      );
    }
    return existing;
  }

  private async createDraft(
    patientId: number,
    currentUserId: number,
    sections: TransitionSummary['sections'],
    pendingChecks: string[],
    author: string,
    sourceDocument: {
      sourceFileName: string;
      sourceFileSize: number;
      sourceStoragePath: string;
    } | null,
  ): Promise<TransitionSummary> {
    const summary = this.summaryRepository.create({
      patientId,
      status: ClinicalSummaryStatus.DRAFT,
      sections,
      pendingChecks,
      draftedByKind: SummaryAuthorKind.HUMAN,
      draftedByName: author,
      draftedAt: new Date(),
      editedById: null,
      editedAt: null,
      approvedById: null,
      approvedAt: null,
      sourceFileName: sourceDocument?.sourceFileName ?? null,
      sourceFileSize: sourceDocument?.sourceFileSize ?? null,
      sourceStoragePath: sourceDocument?.sourceStoragePath ?? null,
      createdAt: new Date(),
      createdById: currentUserId,
    });
    return this.summaryRepository.save(summary);
  }

  private async resolveUserName(userId: number): Promise<string> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    return user ? `${user.firstName} ${user.lastName}`.trim() : 'Médico';
  }

  private assertValidSourceFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('Falta el archivo a subir');
    }
    if (file.size > MAX_SOURCE_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        'El documento supera el tamaño máximo permitido (10 MB)',
      );
    }
    const extension = extname(file.originalname).toLowerCase();
    if (!ALLOWED_SOURCE_EXTENSIONS.has(extension)) {
      throw new BadRequestException(
        `Formato no permitido (${extension || 'sin extensión'}) — usá PDF o Word`,
      );
    }
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
      sourceDocument: summary.sourceFileName
        ? {
            fileName: summary.sourceFileName,
            fileSize: summary.sourceFileSize as number,
          }
        : null,
    };
  }
}
