import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferralReview } from './domain/entities/referrals/referral-review.entity';
import { TransitionSummary } from './domain/entities/clinical/transition-summary.entity';
import { User } from './domain/entities/user.entity';
import { ReferralReviewService } from './application/services/referrals/referral-review.service';
import { ReferralReviewStorageService } from './application/services/referrals/referral-review-storage.service';
import { ReferralReviewsController } from './presentation/controllers/referral-reviews.controller';
import { TransitionModule } from './transition.module';

/**
 * Respuesta del destino (posta/hospital) a la historia clínica de
 * transferencia firmada — depende de TransitionModule (findDetail),
 * nunca al revés. Lee "TransitionSummary" solo para exigir que esté
 * APPROVED antes de aceptar una revisión, mismo criterio que
 * TransitionSummaryModule leyendo tablas de otros dominios vía
 * "forFeature" sin importar sus módulos.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ReferralReview, TransitionSummary, User]),
    TransitionModule,
  ],
  controllers: [ReferralReviewsController],
  providers: [ReferralReviewService, ReferralReviewStorageService],
  exports: [ReferralReviewService],
})
export class ReferralReviewModule {}
