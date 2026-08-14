import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TransitionSummaryService } from '../../application/services/clinical/transition-summary.service';
import { UpdateTransitionSummaryDto } from '../../application/dto/clinical/update-transition-summary.dto';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * "@Controller('patients')" en un controller separado de
 * PatientsController — no hay colisión de rutas porque
 * ":patientId/clinical-summary" es una forma distinta de
 * ":id" (un segmento más), independiente del orden de registro. Ver
 * PUENTE18_FRONTEND_INTEGRATION.md, sección 3.
 */
@ApiTags('transition-summaries')
@ApiBearerAuth()
@Controller('patients')
export class TransitionSummariesController {
  constructor(private readonly summaryService: TransitionSummaryService) {}

  @Get(':patientId/clinical-summary')
  @RequirePermission('PATIENT_READ')
  @ApiOperation({
    summary:
      'Historia clínica de transferencia — 404 si todavía no se generó nada',
  })
  findOne(@Param('patientId', ParseIntPipe) patientId: number) {
    return this.summaryService.findByPatient(patientId);
  }

  @Post(':patientId/clinical-summary')
  @RequirePermission('PATIENT_WRITE')
  @ApiOperation({
    summary:
      'Genera (o regenera, si nadie la editó) el borrador con IA — nunca firma',
  })
  generate(
    @Param('patientId', ParseIntPipe) patientId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.summaryService.generate(patientId, user.id);
  }

  @Put(':patientId/clinical-summary')
  @RequirePermission('PATIENT_WRITE')
  @ApiOperation({
    summary: 'Edita el body de secciones existentes del borrador',
  })
  update(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Body() dto: UpdateTransitionSummaryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.summaryService.update(patientId, dto, user.id);
  }

  @Post(':patientId/clinical-summary/approval')
  @RequirePermission('PATIENT_WRITE')
  @ApiOperation({
    summary:
      'Firma la historia clínica de transferencia — autor y fecha los pone el servidor desde la sesión',
  })
  approve(
    @Param('patientId', ParseIntPipe) patientId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.summaryService.approve(patientId, user.id);
  }

  /**
   * 4 segmentos ("patients/consultation/:code/clinical-summary") contra
   * los 3 de ":patientId/clinical-summary" — no compiten por la misma
   * ruta sea cual sea el orden de registro de los controllers (mismo
   * cuidado que separó "/patient-transitions" de "/patients/:id", ver
   * PUENTE18_FRONTEND_INTEGRATION.md, sección 2).
   */
  @Get('consultation/:code/clinical-summary')
  @RequirePermission('PATIENT_READ')
  @ApiOperation({
    summary:
      'Resuelve el código único del paciente (QR de "Mi recorrido") y devuelve su historia clínica de transferencia — para el médico que lo atiende',
  })
  findByConsultationCode(@Param('code') code: string) {
    return this.summaryService.findByConsultationCode(code);
  }
}
