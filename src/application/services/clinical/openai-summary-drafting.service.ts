import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicalRecord } from '../../../domain/entities/clinical/clinical-record.entity';
import { PatientTransitionResponseDto } from '../../dto/transition/patient-transition-response.dto';
import type { TransitionSummarySection } from '../../../domain/entities/clinical/transition-summary.entity';

/** Las 6 secciones de la historia clínica de transferencia — mismo orden en toda la pantalla. */
export const SUMMARY_SECTION_TEMPLATE: Array<{
  id: string;
  title: string;
  hint: string;
}> = [
  { id: 'quien_es', title: 'Quién es', hint: 'Datos básicos del paciente' },
  {
    id: 'diagnostico',
    title: 'Diagnóstico y desde cuándo',
    hint: 'Diagnóstico principal y desde cuándo está en seguimiento',
  },
  {
    id: 'tratamiento',
    title: 'Tratamiento actual',
    hint: 'Medicación y esquema vigente',
  },
  { id: 'como_viene', title: 'Cómo viene', hint: 'Evolución clínica reciente' },
  {
    id: 'alertas',
    title: 'Alertas y precauciones',
    hint: 'Alergias y alertas clínicas',
  },
  {
    id: 'que_necesita',
    title: 'Qué necesita del hospital de adultos',
    hint: 'Plan de continuidad para quien lo reciba',
  },
];

/**
 * "Generar con IA" — arma el borrador de las 2 hojas con OpenAI a partir
 * del historial clínico ya registrado (ClinicalRecord, dominio de
 * consentimiento) y los datos de la transición. Nunca corre en el
 * navegador — ver TransitionSummaryService.generate.
 *
 * Sin "OPENAI_API_KEY" configurada, este servicio rechaza con 503: nunca
 * cae de vuelta a una plantilla fingida. Quien no tenga la IA prendida
 * usa "Llenar la plantilla" a mano, a propósito una acción distinta.
 */
@Injectable()
export class OpenAiSummaryDraftingService {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(ClinicalRecord)
    private readonly clinicalRecordRepository: Repository<ClinicalRecord>,
  ) {}

  modelName(): string {
    return this.configService.get<string>('app.openaiModel', 'gpt-4o-mini');
  }

  async draft(patient: PatientTransitionResponseDto): Promise<{
    sections: TransitionSummarySection[];
    pendingChecks: string[];
  }> {
    const apiKey = this.configService.get<string>('app.openaiApiKey');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Generar con IA no está disponible: falta configurar OPENAI_API_KEY en el servidor',
      );
    }

    const records = await this.clinicalRecordRepository.find({
      where: { patientId: patient.patientId },
      order: { occurredAt: 'DESC' },
    });

    const payload = {
      model: this.modelName(),
      response_format: { type: 'json_object' as const },
      temperature: 0.3,
      messages: [
        { role: 'system' as const, content: this.systemPrompt() },
        {
          role: 'user' as const,
          content: this.userPrompt(patient, records),
        },
      ],
    };

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo contactar a OpenAI — probá de nuevo en un momento',
      );
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `OpenAI contestó con error (${response.status}) — probá de nuevo en un momento`,
      );
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = body.choices?.[0]?.message?.content;
    if (!raw) {
      throw new ServiceUnavailableException(
        'OpenAI no devolvió ningún contenido',
      );
    }

    return this.parseDraft(raw);
  }

  private systemPrompt(): string {
    const shape = SUMMARY_SECTION_TEMPLATE.map((s) => `"${s.id}"`).join(', ');
    return (
      'Sos un asistente clínico que arma el BORRADOR de una historia clínica ' +
      'de transferencia (pediatría -> adultos) para el sistema de salud peruano. ' +
      'Nunca inventás datos que no estén en lo que te pasan: si falta algo, ' +
      'dejás esa sección vacía ("") y lo anotás en "pendingChecks". ' +
      'Escribís en español, en tono clínico pero legible, oraciones cortas. ' +
      `Devolvé SOLO un JSON con esta forma exacta: {"sections": {${shape}: string, ...}, "pendingChecks": string[]}. ` +
      'Ninguna otra clave, ningún texto fuera del JSON.'
    );
  }

  private userPrompt(
    patient: PatientTransitionResponseDto,
    records: ClinicalRecord[],
  ): string {
    const recordLines =
      records.length > 0
        ? records
            .map(
              (r) =>
                `- [${r.recordType}] ${r.title}${r.occurredAt ? ` (${r.occurredAt})` : ''}${
                  r.details ? `: ${JSON.stringify(r.details)}` : ''
                }`,
            )
            .join('\n')
        : '(sin historial clínico registrado)';

    return [
      `Paciente: ${patient.firstName} ${patient.lastName}, DNI ${patient.documentNumber}, HC ${patient.medicalRecordNumber}.`,
      `Edad: ${patient.age}. Especialidad: ${patient.specialtyName}. Distrito: ${patient.district ?? 'sin registrar'}.`,
      `Diagnóstico principal registrado en el caso: ${patient.primaryDiagnosis ?? 'sin registrar'}.`,
      '',
      'Historial clínico (ClinicalRecord), del más reciente al más antiguo:',
      recordLines,
    ].join('\n');
  }

  private parseDraft(raw: string): {
    sections: TransitionSummarySection[];
    pendingChecks: string[];
  } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ServiceUnavailableException(
        'OpenAI devolvió una respuesta que no se pudo interpretar',
      );
    }
    const obj = parsed as {
      sections?: Record<string, unknown>;
      pendingChecks?: unknown;
    };
    const sectionBodies = obj.sections ?? {};
    const pendingChecks = Array.isArray(obj.pendingChecks)
      ? obj.pendingChecks.filter((c): c is string => typeof c === 'string')
      : [];

    const sections = SUMMARY_SECTION_TEMPLATE.map((template) => {
      const body = sectionBodies[template.id];
      return {
        id: template.id,
        title: template.title,
        hint: template.hint,
        body: typeof body === 'string' ? body : '',
      };
    });
    for (const section of sections) {
      if (
        !section.body &&
        !pendingChecks.some((c) => c.includes(section.title))
      ) {
        pendingChecks.push(
          `Sección "${section.title}" sin información suficiente`,
        );
      }
    }
    return { sections, pendingChecks };
  }
}
