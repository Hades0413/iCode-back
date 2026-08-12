/**
 * En qué punto del recorrido pediátrico→adultos está un paciente — quién
 * tiene el caso en cada estado (ver PUENTE18_FRONTEND_INTEGRATION.md,
 * sección 2). Nunca se infiere de otra columna: lo mueven los servicios
 * de este dominio (PostNoticeService al avisar a la posta, etc.), nunca
 * un trigger ni un cálculo derivado — a diferencia de "is adult", que sí
 * se calcula siempre desde "DateOfBirth" (ver TitleTransferService).
 */
export enum TransitionState {
  PENDING = 'PENDING',
  IN_PREPARATION = 'IN_PREPARATION',
  REFERRED_TO_POST = 'REFERRED_TO_POST',
  APPOINTMENT_IN_PROCESS = 'APPOINTMENT_IN_PROCESS',
  APPOINTMENT_GRANTED = 'APPOINTMENT_GRANTED',
  FIRST_CARE_DONE = 'FIRST_CARE_DONE',
  LOST_TO_FOLLOW_UP = 'LOST_TO_FOLLOW_UP',
  READMITTED = 'READMITTED',
}
