import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReferralService } from '../../application/services/referrals/referral.service';
import { SendReferralAlertDto } from '../../application/dto/referrals/send-referral-alert.dto';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Sin prefijo de clase: cada método declara su path completo porque
 * este módulo mezcla el recurso propio del área ("/referrals/...") con
 * sub-recursos de "/patients/:patientId/..." — ver
 * PUENTE18_FRONTEND_INTEGRATION.md, sección 4.
 */
@ApiTags('referrals')
@ApiBearerAuth()
@Controller()
export class ReferralsController {
  constructor(private readonly referralService: ReferralService) {}

  @Get('referrals/notice-queue')
  @RequirePermission('REFERRAL_READ')
  @ApiOperation({
    summary:
      'Bandeja del área: pacientes en tutela que cumplen 18 en 2 meses o menos',
  })
  findNoticeQueue() {
    return this.referralService.findNoticeQueue();
  }

  @Post('patients/:patientId/post-notices')
  @RequirePermission('HEALTH_POST_NOTIFY')
  @ApiOperation({ summary: 'Registra el aviso a la posta del distrito' })
  notifyHealthPost(
    @Param('patientId', ParseIntPipe) patientId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.referralService.notifyHealthPost(patientId, user.id);
  }

  @Post('patients/:patientId/referral-alerts')
  @RequirePermission('REFERRAL_AREA_NOTIFY')
  @ApiOperation({
    summary:
      'El especialista le reclama al área — la razón la recalcula siempre el servidor',
  })
  sendReferralAlert(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Body() dto: SendReferralAlertDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.referralService.sendReferralAlert(
      patientId,
      dto.reason,
      user.id,
    );
  }
}
