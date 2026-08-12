import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostNotice } from './domain/entities/referrals/post-notice.entity';
import { ReferralAlert } from './domain/entities/referrals/referral-alert.entity';
import { ReferralService } from './application/services/referrals/referral.service';
import { ReferralsController } from './presentation/controllers/referrals.controller';
import { TransitionModule } from './transition.module';

/**
 * Avisos a la posta y reclamos del especialista — depende de
 * TransitionModule, nunca al revés. Ver
 * PUENTE18_FRONTEND_INTEGRATION.md, sección 4.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([PostNotice, ReferralAlert]),
    TransitionModule,
  ],
  controllers: [ReferralsController],
  providers: [ReferralService],
  exports: [ReferralService],
})
export class ReferralModule {}
