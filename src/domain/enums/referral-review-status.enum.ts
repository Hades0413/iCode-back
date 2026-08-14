/**
 * Qué dijo el destino (posta o el hospital de adultos) al recibir la
 * historia clínica de transferencia firmada. "PENDIENTE" no es un valor
 * de esta columna: significa que la fila no existe todavía — mismo
 * criterio que CounterReferralStatus/ClinicalSummaryStatus.
 */
export enum ReferralReviewStatus {
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  OBSERVED = 'OBSERVED',
}
