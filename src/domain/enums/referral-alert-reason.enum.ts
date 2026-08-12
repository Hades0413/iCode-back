/**
 * Por qué el especialista le reclama al área de Referencias y
 * Contrarreferencias. Nunca lo elige el cliente: lo recalcula siempre
 * ReferralDecisionService.pendingAction — ver
 * PUENTE18_FRONTEND_INTEGRATION.md, sección 4.
 */
export enum ReferralAlertReason {
  POST_NOTICE = 'POST_NOTICE',
  COUNTER_REFERRAL = 'COUNTER_REFERRAL',
  RESCHEDULE = 'RESCHEDULE',
}
