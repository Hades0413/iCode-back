import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PatientTransitionService } from '../../application/services/transition/patient-transition.service';
import { CreatePatientTransitionDto } from '../../application/dto/transition/create-patient-transition.dto';
import { UpdatePatientTransitionDto } from '../../application/dto/transition/update-patient-transition.dto';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Recurso propio ("patient-transitions"), no anidado bajo "/patients":
 * evita que las rutas estáticas de abajo (in-tutelage, post-transition)
 * puedan quedar sombreadas por "GET /patients/:id" de PatientsController
 * según el orden en que Nest registre los controllers — ver
 * PUENTE18_FRONTEND_INTEGRATION.md, sección 2.
 */
@ApiTags('patient-transitions')
@ApiBearerAuth()
@Controller('patient-transitions')
export class PatientTransitionsController {
  constructor(private readonly transitionService: PatientTransitionService) {}

  @Post()
  @RequirePermission('PATIENT_WRITE')
  @ApiOperation({
    summary:
      'Da de alta el seguimiento de transición de un paciente ya registrado',
  })
  create(
    @Body() dto: CreatePatientTransitionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transitionService.create(dto, user.id);
  }

  @Get('in-tutelage')
  @RequirePermission('PATIENT_READ')
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

  @Get(':patientId')
  @RequirePermission('PATIENT_READ')
  @ApiOperation({ summary: 'Detalle del caso de transición de un paciente' })
  findOne(@Param('patientId', ParseIntPipe) patientId: number) {
    return this.transitionService.findDetail(patientId);
  }

  @Patch(':patientId')
  @RequirePermission('PATIENT_WRITE')
  @ApiOperation({
    summary:
      'Actualiza datos del caso (especialidad, posta asignada, derivación, cita) — nunca el "State", eso lo mueven los servicios del dominio',
  })
  async update(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Body() dto: UpdatePatientTransitionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.transitionService.assertSpecialtyMatches(patientId, user.id);
    return this.transitionService.update(patientId, dto, user.id);
  }
}
