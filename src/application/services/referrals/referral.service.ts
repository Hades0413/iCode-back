import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PostNotice } from '../../../domain/entities/referrals/post-notice.entity';
import { ReferralAlert } from '../../../domain/entities/referrals/referral-alert.entity';
import { ReferralAlertReason } from '../../../domain/enums/referral-alert-reason.enum';
import { TransitionState } from '../../../domain/enums/transition-state.enum';
import { PatientTransitionService } from '../transition/patient-transition.service';
import { PatientTransitionResponseDto } from '../../dto/transition/patient-transition-response.dto';

/** El aviso sale exactamente 2 meses antes del cumpleaños. */
const NOTICE_MONTHS_BEFORE_18 = 2;
/** A partir de 1 mes sin aviso, el especialista puede reclamar. */
const NOTICE_OVERDUE_MONTHS_BEFORE_18 = 1;

/**
 * El área de Referencias y Contrarreferencias — avisos a la posta y
 * reclamos del especialista. Depende de TransitionModule
 * (setReferredToPost/getRuleContext/findAllInTutelage), nunca al revés.
 * Ver PUENTE18_FRONTEND_INTEGRATION.md, sección 4.
 */
@Injectable()
export class ReferralService {
  constructor(
    @InjectRepository(PostNotice)
    private readonly postNoticeRepository: Repository<PostNotice>,
    @InjectRepository(ReferralAlert)
    private readonly referralAlertRepository: Repository<ReferralAlert>,
    private readonly patientTransitionService: PatientTransitionService,
  ) {}

  /**
   * GET /referrals/notice-queue — su propia pregunta, no un filtro sobre
   * la cohorte de un médico: trae a TODOS los que cumplen 18 en ≤2 meses,
   * sin importar la especialidad.
   */
  async findNoticeQueue(): Promise<PatientTransitionResponseDto[]> {
    const all = await this.patientTransitionService.findAllInTutelage();
    return all.filter((p) => p.monthsToEighteen <= NOTICE_MONTHS_BEFORE_18);
  }

  async notifyHealthPost(
    patientId: number,
    currentUserId: number,
  ): Promise<PatientTransitionResponseDto> {
    const context =
      await this.patientTransitionService.getRuleContext(patientId);
    // "canNotifyHealthPost" del front: isInNoticeWindow (que a su vez
    // exige isInTutelage, no solo "<=2 meses") O ya cumplió 18 y la carta
    // no salió — sin el "> 0" de abajo, un paciente adulto con la carta
    // YA enviada volvía a calificar por la primera rama sola.
    const inNoticeWindow =
      context.monthsToEighteen > 0 &&
      context.monthsToEighteen <= NOTICE_MONTHS_BEFORE_18;
    const canNotify =
      context.healthPostFacilityId !== null &&
      (inNoticeWindow ||
        (context.isAdult && context.counterReferralStatus !== 'SENT'));
    if (!canNotify) {
      throw new ConflictException(
        'No corresponde avisar a la posta para este paciente todavía (sin posta asignada, fuera de ventana, o la carta ya se envió)',
      );
    }

    const notice = this.postNoticeRepository.create({
      patientId,
      sentAt: new Date(),
      sentById: currentUserId,
      createdAt: new Date(),
      createdById: currentUserId,
    });
    await this.postNoticeRepository.save(notice);
    await this.patientTransitionService.setReferredToPost(
      patientId,
      notice.sentAt,
      currentUserId,
    );
    return this.patientTransitionService.findDetail(patientId);
  }

  async sendReferralAlert(
    patientId: number,
    requestedReason: ReferralAlertReason | undefined,
    currentUserId: number,
  ): Promise<PatientTransitionResponseDto> {
    const pendingAction = await this.pendingReferralAction(patientId);
    if (pendingAction === null) {
      throw new ConflictException(
        'No hay nada pendiente que reclamarle al área para este paciente',
      );
    }
    if (requestedReason !== undefined && requestedReason !== pendingAction) {
      throw new ConflictException(
        `Lo que falta en realidad es "${pendingAction}", no "${requestedReason}"`,
      );
    }

    const alert = this.referralAlertRepository.create({
      patientId,
      reason: pendingAction,
      sentAt: new Date(),
      sentById: currentUserId,
      createdAt: new Date(),
      createdById: currentUserId,
    });
    await this.referralAlertRepository.save(alert);
    return this.patientTransitionService.findDetail(patientId);
  }

  /**
   * Prioridad: 1º aviso vencido, 2º carta pendiente tras los 18, 3º
   * pérdida de seguimiento — el servidor la recalcula siempre, el
   * cliente nunca la elige (ver SendReferralAlertDto).
   */
  private async pendingReferralAction(
    patientId: number,
  ): Promise<ReferralAlertReason | null> {
    const context =
      await this.patientTransitionService.getRuleContext(patientId);

    if (
      context.monthsToEighteen <= NOTICE_OVERDUE_MONTHS_BEFORE_18 &&
      context.monthsToEighteen > 0
    ) {
      const noticeCount = await this.postNoticeRepository.count({
        where: { patientId },
      });
      if (noticeCount === 0) {
        return ReferralAlertReason.POST_NOTICE;
      }
    }

    // "isCounterReferralDue" del front es "!== SENT", no "=== NONE": una
    // carta ya UPLOADED pero sin enviar sigue siendo motivo de reclamo.
    if (context.isAdult && context.counterReferralStatus !== 'SENT') {
      return ReferralAlertReason.COUNTER_REFERRAL;
    }

    if (
      context.isAdult &&
      context.state === TransitionState.LOST_TO_FOLLOW_UP
    ) {
      return ReferralAlertReason.RESCHEDULE;
    }

    return null;
  }
}
