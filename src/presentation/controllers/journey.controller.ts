import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JourneyService } from '../../application/services/journey/journey.service';
import { SetChecklistItemDto } from '../../application/dto/journey/set-checklist-item.dto';
import { SendReminderDto } from '../../application/dto/journey/send-reminder.dto';
import { SetGuardianAccessDto } from '../../application/dto/journey/set-guardian-access.dto';
import { ReportAppointmentDto } from '../../application/dto/journey/report-appointment.dto';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Ningún endpoint recibe "patientId": el paciente activo sale siempre de
 * la sesión (el propio dueño, o el que acompaña el tutor logueado) — ver
 * PUENTE18_FRONTEND_INTEGRATION.md, sección 6.
 */
@ApiTags('journey')
@ApiBearerAuth()
@Controller('journey')
export class JourneyController {
  constructor(private readonly journeyService: JourneyService) {}

  @Get()
  @RequirePermission('JOURNEY_READ')
  @ApiOperation({
    summary:
      'El recorrido propio, o el del paciente que acompaña el tutor — 200 con access:"REVOKED" si el acceso fue quitado, nunca 403',
  })
  getJourney(@CurrentUser() user: AuthenticatedUser) {
    return this.journeyService.getJourney(user.id);
  }

  @Patch('checklist/:itemId')
  @RequirePermission('CHECKLIST_WRITE')
  @ApiOperation({
    summary: 'Tilda/destilda un ítem — solo el paciente titular',
  })
  setChecklistItemDone(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: SetChecklistItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.journeyService.setChecklistItemDone(itemId, dto.done, user.id);
  }

  @Post('reminders')
  @RequirePermission('GUARDIAN_REMIND')
  @ApiOperation({
    summary: 'Quien acompaña le manda un recordatorio al paciente',
  })
  sendReminder(
    @Body() dto: SendReminderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.journeyService.sendReminder(dto.text, user.id);
  }

  @Put('guardian-access')
  @RequirePermission('GUARDIAN_ACCESS_MANAGE')
  @ApiOperation({
    summary:
      'El paciente titular da o quita el acceso de su tutor al recorrido',
  })
  setGuardianAccess(
    @Body() dto: SetGuardianAccessDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.journeyService.setGuardianAccess(dto.hasAccess, user.id);
  }

  @Delete('messages/:messageId')
  @RequirePermission('JOURNEY_READ')
  @ApiOperation({
    summary: 'Descarta un recordatorio — solo el paciente titular',
  })
  dismissMessage(
    @Param('messageId', ParseIntPipe) messageId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.journeyService.dismissMessage(messageId, user.id);
  }

  @Put('appointment')
  @RequirePermission('APPOINTMENT_SELF_REPORT')
  @ApiOperation({
    summary:
      'El paciente registra una cita que consiguió por su cuenta — 409 si ya tenía una',
  })
  reportAppointment(
    @Body() dto: ReportAppointmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.journeyService.reportAppointment(dto, user.id);
  }

  @Post('consultation-code')
  @RequirePermission('CONSULTATION_CODE_MANAGE')
  @ApiOperation({
    summary:
      'Genera (o regenera) el código único para que un médico vea el resumen clínico en la consulta',
  })
  generateConsultationCode(@CurrentUser() user: AuthenticatedUser) {
    return this.journeyService.generateConsultationCode(user.id);
  }
}
