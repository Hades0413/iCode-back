import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CounterReferral } from './domain/entities/referrals/counter-referral.entity';
import { CounterReferralService } from './application/services/referrals/counter-referral.service';
import { CounterReferralStorageService } from './application/services/referrals/counter-referral-storage.service';
import { CounterReferralsController } from './presentation/controllers/counter-referrals.controller';
import { TransitionModule } from './transition.module';

/**
 * La carta de contrarreferencia — depende de TransitionModule, nunca al
 * revés. Ver PUENTE18_FRONTEND_INTEGRATION.md, sección 5.
 */
@Module({
  imports: [TypeOrmModule.forFeature([CounterReferral]), TransitionModule],
  controllers: [CounterReferralsController],
  providers: [CounterReferralService, CounterReferralStorageService],
  exports: [CounterReferralService],
})
export class CounterReferralModule {}
