/**
 * Estado de la carta de contrarreferencia. "NONE" (todavía no se subió
 * nada) no es un valor de esta columna: significa que la fila no existe
 * — ver CounterReferralService.findByPatient.
 */
export enum CounterReferralStatus {
  UPLOADED = 'UPLOADED',
  SENT = 'SENT',
}
