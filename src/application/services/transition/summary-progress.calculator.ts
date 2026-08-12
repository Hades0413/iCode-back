import { ClinicalSummaryStatus } from '../../../domain/enums/clinical-summary-status.enum';
import { TransitionSummarySection } from '../../../domain/entities/clinical/transition-summary.entity';

/**
 * Función pura (sin acceso a base de datos) para que la use tanto el
 * listado de cohorte (solo lectura, ver PatientTransitionService) como
 * TransitionSummaryService (que sí escribe) sin que ninguno dependa del
 * otro — ver PUENTE18_FRONTEND_INTEGRATION.md, sección 3.
 *
 * "DRAFT_CEILING": un borrador nunca llega a 100% — el 15% restante es
 * la firma. Si ya está "APPROVED" da 1 sin mirar las secciones (una
 * historia firmada está completa por definición, aunque alguna sección
 * haya quedado breve a propósito).
 */
const DRAFT_CEILING = 0.85;

export function calculateSummaryProgress(
  sections: TransitionSummarySection[],
  status: ClinicalSummaryStatus,
): number {
  if (status === ClinicalSummaryStatus.APPROVED) {
    return 1;
  }
  if (sections.length === 0) {
    return 0;
  }
  const withBody = sections.filter((s) => s.body.trim().length > 0).length;
  return (withBody / sections.length) * DRAFT_CEILING;
}
