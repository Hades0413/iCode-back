import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Res,
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
import type { Response } from 'express';
import { PatientAttachmentService } from '../../application/services/patients/patient-attachment.service';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * "Exámenes y documentos" de la ficha del paciente — ver
 * PatientAttachmentService. "@Controller('patients')" separado de
 * PatientsController, mismo criterio que TransitionSummariesController.
 */
@ApiTags('patient-attachments')
@ApiBearerAuth()
@Controller('patients')
export class PatientAttachmentsController {
  constructor(private readonly attachmentService: PatientAttachmentService) {}

  @Get(':patientId/attachments')
  @RequirePermission('PATIENT_READ')
  @ApiOperation({ summary: 'Lista de exámenes y documentos adjuntos' })
  findByPatient(@Param('patientId', ParseIntPipe) patientId: number) {
    return this.attachmentService.findByPatient(patientId);
  }

  /**
   * "Pase de consulta" — 3 segmentos ("patients/consultation/:code/attachments")
   * contra los 2 de ":patientId/attachments": no compiten por la misma ruta
   * sea cual sea el orden de registro, mismo criterio que
   * TransitionSummariesController (ver PUENTE18_FRONTEND_INTEGRATION.md,
   * sección 3).
   */
  @Get('consultation/:code/attachments')
  @RequirePermission('PATIENT_READ')
  @ApiOperation({
    summary:
      'Resuelve el código único del paciente y devuelve sus exámenes y documentos adjuntos — para el médico que lo atiende',
  })
  findByConsultationCode(@Param('code') code: string) {
    return this.attachmentService.findByConsultationCode(code);
  }

  @Post(':patientId/attachments')
  @RequirePermission('PATIENT_WRITE')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary:
      'Adjunta un examen o documento (imagen, PDF, Word o video, máx. 25MB)',
  })
  upload(
    @Param('patientId', ParseIntPipe) patientId: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attachmentService.upload(patientId, file, user.id);
  }

  @Get(':patientId/attachments/:attachmentId/document')
  @RequirePermission('PATIENT_READ')
  @ApiOperation({ summary: 'Descarga el archivo adjunto' })
  async downloadDocument(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @Res() res: Response,
  ) {
    const attachment = await this.attachmentService.getOrFail(
      patientId,
      attachmentId,
    );
    const absolutePath = this.attachmentService.resolveDocumentPath(attachment);
    res.download(absolutePath, attachment.fileName);
  }

  @Delete(':patientId/attachments/:attachmentId')
  @RequirePermission('PATIENT_WRITE')
  @ApiOperation({ summary: 'Quita un examen o documento adjunto' })
  remove(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attachmentService.remove(patientId, attachmentId, user.id);
  }
}
