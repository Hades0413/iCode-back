import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
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
import { CounterReferralService } from '../../application/services/referrals/counter-referral.service';
import { UploadCounterReferralDto } from '../../application/dto/referrals/upload-counter-referral.dto';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

@ApiTags('counter-referrals')
@ApiBearerAuth()
@Controller()
export class CounterReferralsController {
  constructor(
    private readonly counterReferralService: CounterReferralService,
  ) {}

  @Get('referrals/counter-queue')
  @RequirePermission('REFERRAL_READ')
  @ApiOperation({
    summary: 'Bandeja del área: una tarjeta por paciente que ya cumplió 18',
  })
  findCounterQueue() {
    return this.counterReferralService.findCounterQueue();
  }

  @Get('patients/:patientId/counter-referral')
  @RequirePermission('PATIENT_READ')
  @ApiOperation({ summary: 'Estado de la carta — 404 si todavía no se subió' })
  findOne(@Param('patientId', ParseIntPipe) patientId: number) {
    return this.counterReferralService.findByPatient(patientId);
  }

  @Post('patients/:patientId/counter-referral')
  @RequirePermission('COUNTER_REFERRAL_MANAGE')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary:
      'Sube la carta (PDF/Word, máx. 10MB) — nunca antes del cumpleaños del paciente',
  })
  upload(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Body() dto: UploadCounterReferralDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.counterReferralService.upload(patientId, dto, file, user.id);
  }

  @Post('patients/:patientId/counter-referral/delivery')
  @RequirePermission('COUNTER_REFERRAL_MANAGE')
  @ApiOperation({
    summary:
      'Envía la carta ya subida — sub-recurso propio, irreversible, con autor y fecha del servidor',
  })
  deliver(
    @Param('patientId', ParseIntPipe) patientId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.counterReferralService.deliver(patientId, user.id);
  }
}
