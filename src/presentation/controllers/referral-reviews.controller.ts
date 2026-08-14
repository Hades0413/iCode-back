import {
  Body,
  Controller,
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
import { ReferralReviewService } from '../../application/services/referrals/referral-review.service';
import { ReviewReferralRejectionDto } from '../../application/dto/referrals/review-referral-rejection.dto';
import { ReviewReferralObservationDto } from '../../application/dto/referrals/review-referral-observation.dto';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Lo que el área de Referencias registra sobre la respuesta del destino
 * a la historia clínica de transferencia firmada — ver
 * ReferralReviewService. "@Controller('patients')" separado de
 * PatientsController, mismo criterio que TransitionSummariesController.
 */
@ApiTags('referral-reviews')
@ApiBearerAuth()
@Controller('patients')
export class ReferralReviewsController {
  constructor(private readonly reviewService: ReferralReviewService) {}

  @Get(':patientId/referral-review')
  @RequirePermission('PATIENT_READ')
  @ApiOperation({
    summary: 'Respuesta del destino — 404 si todavía está pendiente',
  })
  findOne(@Param('patientId', ParseIntPipe) patientId: number) {
    return this.reviewService.findByPatient(patientId);
  }

  @Get(':patientId/referral-review/document')
  @RequirePermission('PATIENT_READ')
  @ApiOperation({
    summary: 'Descarga el PDF de la observación — 404 si no hay ninguno',
  })
  async downloadDocument(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Res() res: Response,
  ) {
    const review = await this.reviewService.getOrFail(patientId);
    const absolutePath = this.reviewService.resolveDocumentPath(review);
    res.download(absolutePath, review.fileName ?? 'observacion.pdf');
  }

  @Post(':patientId/referral-review/acceptance')
  @RequirePermission('REFERRAL_REVIEW_MANAGE')
  @ApiOperation({ summary: 'El destino aceptó el caso' })
  accept(
    @Param('patientId', ParseIntPipe) patientId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewService.accept(patientId, user.id);
  }

  @Post(':patientId/referral-review/rejection')
  @RequirePermission('REFERRAL_REVIEW_MANAGE')
  @ApiOperation({ summary: 'El destino rechazó el caso' })
  reject(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Body() dto: ReviewReferralRejectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewService.reject(patientId, dto, user.id);
  }

  @Post(':patientId/referral-review/observation')
  @RequirePermission('REFERRAL_REVIEW_MANAGE')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary:
      'El destino observó la historia clínica — adjunta un PDF (máx. 10MB) explicando qué falta',
  })
  observe(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Body() dto: ReviewReferralObservationDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviewService.observe(patientId, dto, file, user.id);
  }
}
