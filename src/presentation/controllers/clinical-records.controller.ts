import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClinicalRecordService } from '../../application/services/clinical/clinical-record.service';
import { TransitionFileService } from '../../application/services/clinical/transition-file.service';
import { CreateClinicalRecordDto } from '../../application/dto/clinical/create-clinical-record.dto';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

@ApiTags('clinical-records')
@ApiBearerAuth()
@Controller('patients/:patientId/clinical-records')
export class ClinicalRecordsController {
  constructor(
    private readonly clinicalRecordService: ClinicalRecordService,
    private readonly transitionFileService: TransitionFileService,
  ) {}

  @Post()
  @RequirePermission('CLINICAL_RECORD_WRITE')
  @ApiOperation({
    summary:
      'Registrar un ítem del historial clínico (diagnóstico, medicación, alergia, cirugía o examen)',
  })
  create(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Body() dto: CreateClinicalRecordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicalRecordService.create(patientId, dto, user.id);
  }

  @Get()
  @RequirePermission('CLINICAL_RECORD_READ')
  @ApiOperation({
    summary:
      'Historial clínico completo del paciente (vista interna, sin filtrar por consentimiento)',
  })
  findByPatient(@Param('patientId', ParseIntPipe) patientId: number) {
    return this.clinicalRecordService.findByPatient(patientId);
  }

  @Get('transition-file')
  @RequirePermission('CLINICAL_RECORD_READ')
  @ApiOperation({
    summary:
      'Genera la "ficha de transición" portable, agrupada por tipo (requisito #6 del hackatón)',
  })
  generateTransitionFile(@Param('patientId', ParseIntPipe) patientId: number) {
    return this.transitionFileService.generate(patientId);
  }
}
