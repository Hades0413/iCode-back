/**
 * Estado de la historia clínica de transferencia (las "2 hojas" que
 * acompañan al paciente al hospital de adultos). "NONE" (todavía no se
 * generó nada) no es un valor de esta columna: significa que la fila no
 * existe — ver ClinicalSummaryService.findByPatient.
 */
export enum ClinicalSummaryStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
}
