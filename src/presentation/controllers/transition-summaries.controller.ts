import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { TransitionSummaryService } from '../../application/services/clinical/transition-summary.service';
import { PatientTransitionService } from '../../application/services/transition/patient-transition.service';
import { UpdateTransitionSummaryDto } from '../../application/dto/clinical/update-transition-summary.dto';
import { ReportAppointmentDto } from '../../application/dto/journey/report-appointment.dto';
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
  constructor(
    private readonly summaryService: TransitionSummaryService,
    private readonly transitionService: PatientTransitionService,
  ) {}

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

  @Delete(':patientId/clinical-summary')
  @RequirePermission('PATIENT_WRITE')
  @ApiOperation({
    summary:
      '"Descartar borrador" — vuelve a NONE para empezar de nuevo (a mano, con la plantilla, subiendo otro documento o generando de nuevo). Nunca sobre una historia ya firmada',
  })
  discard(
    @Param('patientId', ParseIntPipe) patientId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.summaryService.discard(patientId, user.id);
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

  @Post(':patientId/clinical-summary/template')
  @RequirePermission('PATIENT_WRITE')
  @ApiOperation({
    summary:
      '"Llenar la plantilla" — arranca un borrador en blanco a mano, sin IA',
  })
  startBlankTemplate(
    @Param('patientId', ParseIntPipe) patientId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.summaryService.startBlankTemplate(patientId, user.id);
  }

  @Post(':patientId/clinical-summary/document')
  @RequirePermission('PATIENT_WRITE')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary:
      '"Subir el documento" — la historia ya viene redactada aparte (PDF/Word, máx. 10MB); solo se adjunta',
  })
  uploadSourceDocument(
    @Param('patientId', ParseIntPipe) patientId: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.summaryService.uploadSourceDocument(patientId, file, user.id);
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

  /**
   * El encabezado del "pase de consulta" (iniciales, edad, especialidad,
   * diagnóstico) — recurso separado de la historia clínica de arriba,
   * mismo código, mismo criterio que "GET /patients/:id" vs
   * "GET /patients/:id/clinical-summary".
   */
  @Get('consultation/:code')
  @RequirePermission('PATIENT_READ')
  @ApiOperation({
    summary:
      'Resuelve el código único del paciente y devuelve los datos de su ficha — para el encabezado del pase de consulta',
  })
  findPatientByConsultationCode(@Param('code') code: string) {
    return this.transitionService.findDetailByConsultationCode(code);
  }

  /**
   * "Registrar esta atención": el médico confirma que la consulta de hoy
   * pasó, con qué hospital/doctor/fecha/hora — llena la cita si el
   * paciente no la tenía y pasa el caso a FIRST_CARE_DONE. Pide
   * PATIENT_WRITE (no uno nuevo): es la misma acción de escribir el caso
   * que ya protegía "PATCH /patient-transitions/:patientId".
   */
  @Post('consultation/:code/visit')
  @RequirePermission('PATIENT_WRITE')
  @ApiOperation({
    summary:
      'Registra la atención de hoy (hospital, doctor, fecha y hora) y pasa el caso a FIRST_CARE_DONE',
  })
  registerConsultationVisit(
    @Param('code') code: string,
    @Body() dto: ReportAppointmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transitionService.registerConsultationVisit(code, dto, user.id);
  }
}
