import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { HealthFacilityAccessService } from '../../application/services/consent/health-facility-access.service';
import { QueryClinicalSummaryDto } from '../../application/dto/consent/query-clinical-summary.dto';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * El endpoint simulado del requisito #4: un centro de salud (identificado
 * por el "HealthFacilityId" del usuario que llama, ver User.entity.ts)
 * consulta el resumen clínico de un paciente por su documento. Se
 * autoriza a nivel de permiso (IPRESS_QUERY) y, además, a nivel de
 * consentimiento (AccessDecisionService) por cada request — el permiso
 * dice "puede consultar pacientes en general", no "puede ver a ESTE
 * paciente ni con qué alcance", eso lo decide el consentimiento vigente.
 *
 * Simplificación deliberada para el prototipo: "isEmergency" no exige el
 * permiso "IPRESS_EMERGENCY_ACCESS" por separado — cualquiera con
 * IPRESS_QUERY puede declarar una consulta como emergencia. En un
 * despliegue real convendría exigir ambos permisos y/o una revisión
 * posterior de cada emergencia declarada (queda registrada en
 * "ClinicalAccessLog" para eso).
 */
@ApiTags('health-facility-access')
@ApiBearerAuth()
@Controller('health-facility-access/patients')
export class HealthFacilityAccessController {
  constructor(
    private readonly healthFacilityAccessService: HealthFacilityAccessService,
  ) {}

  @Get(':documentNumber/clinical-summary')
  @RequirePermission('IPRESS_QUERY')
  @ApiOperation({
    summary:
      'Consulta simulada de un centro de salud al resumen clínico de un paciente por documento — respeta autorización vigente y la excepción de emergencia solo para información BASICA',
  })
  queryClinicalSummary(
    @Param('documentNumber') documentNumber: string,
    @Query() query: QueryClinicalSummaryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.healthFacilityAccessService.queryClinicalSummary(
      documentNumber,
      { userId: user.id, ipAddress: req.ip },
      query,
    );
  }
}
