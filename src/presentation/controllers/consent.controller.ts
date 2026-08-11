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
import { ConsentService } from '../../application/services/consent/consent.service';
import { ClinicalAccessLogService } from '../../application/services/consent/clinical-access-log.service';
import { CreateAccessAuthorizationDto } from '../../application/dto/consent/create-access-authorization.dto';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

@ApiTags('consent')
@ApiBearerAuth()
@Controller('patients/:patientId')
export class ConsentController {
  constructor(
    private readonly consentService: ConsentService,
    private readonly accessLogService: ClinicalAccessLogService,
  ) {}

  @Post('access-authorizations')
  @RequirePermission('CONSENT_MANAGE')
  @ApiOperation({
    summary:
      'Otorga acceso a una IPRESS — solo lo puede hacer el titular vigente (paciente adulto, o su tutor activo mientras es menor)',
  })
  grant(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Body() dto: CreateAccessAuthorizationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.consentService.grant(patientId, dto, user.id);
  }

  @Patch('access-authorizations/:authorizationId/revoke')
  @RequirePermission('CONSENT_MANAGE')
  @ApiOperation({ summary: 'Revoca una autorización previamente otorgada' })
  revoke(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Param('authorizationId', ParseIntPipe) authorizationId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.consentService.revoke(patientId, authorizationId, user.id);
  }

  @Get('access-authorizations')
  @RequirePermission('CONSENT_VIEW')
  @ApiOperation({
    summary: 'Autorizaciones de acceso del paciente (activas y revocadas)',
  })
  findByPatient(@Param('patientId', ParseIntPipe) patientId: number) {
    return this.consentService.findByPatient(patientId);
  }

  @Get('access-log')
  @RequirePermission('ACCESS_LOG_VIEW')
  @ApiOperation({
    summary:
      'Bitácora de accesos a la ficha clínica del paciente — quién consultó y cuándo',
  })
  findAccessLog(@Param('patientId', ParseIntPipe) patientId: number) {
    return this.accessLogService.findByPatient(patientId);
  }
}
