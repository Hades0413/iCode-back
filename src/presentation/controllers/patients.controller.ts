import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PatientService } from '../../application/services/patients/patient.service';
import { TitleTransferService } from '../../application/services/patients/title-transfer.service';
import { PatientTransitionService } from '../../application/services/transition/patient-transition.service';
import { CreatePatientDto } from '../../application/dto/patients/create-patient.dto';
import { CreateLegalGuardianDto } from '../../application/dto/patients/create-legal-guardian.dto';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

@ApiTags('patients')
@ApiBearerAuth()
@Controller('patients')
export class PatientsController {
  constructor(
    private readonly patientService: PatientService,
    private readonly titleTransferService: TitleTransferService,
    private readonly transitionService: PatientTransitionService,
  ) {}

  @Post()
  @RequirePermission('PATIENT_WRITE')
  @ApiOperation({
    summary: 'Registrar un paciente (datos ficticios/sintéticos)',
  })
  create(
    @Body() dto: CreatePatientDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.patientService.create(dto, user.id);
  }

  /**
   * Declaradas ANTES de "GET :id" a propósito — Express matea rutas en
   * el orden en que se registran DENTRO de la misma clase, así que
   * "in-tutelage"/"post-transition" tienen que ganarle a ":id" sin
   * depender de en qué orden Nest resuelva los módulos (ver
   * patients.module.ts y PUENTE18_FRONTEND_INTEGRATION.md, sección 2).
   */
  @Get('in-tutelage')
  @RequirePermission('PATIENT_COHORT_READ')
  @ApiOperation({
    summary:
      'El tablero del especialista: pacientes en tutela (menores de 18), recortado por su propia especialidad',
  })
  findInTutelage(@CurrentUser() user: AuthenticatedUser) {
    return this.transitionService.findInTutelage(user.id);
  }

  @Get('post-transition')
  @RequirePermission('REPORT_READ')
  @ApiOperation({
    summary:
      'Panel de seguimiento: pacientes que ya cumplieron 18 — vista de supervisión, sin recorte por especialidad',
  })
  findPostTransition() {
    return this.transitionService.findPostTransition();
  }

  @Get(':id')
  @RequirePermission('PATIENT_READ')
  @ApiOperation({
    summary:
      'Datos del paciente + quién es su titular vigente (paciente adulto o tutor activo)',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.patientService.findById(id);
  }

  @Post(':id/guardians')
  @RequirePermission('PATIENT_WRITE')
  @ApiOperation({
    summary: 'Vincular un tutor legal a un paciente menor de edad',
  })
  addGuardian(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateLegalGuardianDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.patientService.addGuardian(id, dto, user.id);
  }

  @Post(':id/transfer-title')
  @RequirePermission('PATIENT_WRITE')
  @ApiOperation({
    summary:
      'Dispara el traspaso de titularidad si el paciente ya cumplió 18 (desactiva a sus tutores) — idempotente, no hace nada si sigue siendo menor',
  })
  transferTitle(@Param('id', ParseIntPipe) id: number) {
    return this.titleTransferService.transferIfEligible(id);
  }
}
