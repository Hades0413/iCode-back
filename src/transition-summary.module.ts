import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransitionSummary } from './domain/entities/clinical/transition-summary.entity';
import { TransitionSummaryService } from './application/services/clinical/transition-summary.service';
import { TransitionSummariesController } from './presentation/controllers/transition-summaries.controller';
import { TransitionModule } from './transition.module';

/**
 * La historia clínica de transferencia — depende de TransitionModule
 * (setState/assertSpecialtyMatches/findDetail/getRuleContext), nunca al
 * revés. Ver PUENTE18_FRONTEND_INTEGRATION.md, sección 3.
 */
@Module({
  imports: [TypeOrmModule.forFeature([TransitionSummary]), TransitionModule],
  controllers: [TransitionSummariesController],
  providers: [TransitionSummaryService],
  exports: [TransitionSummaryService],
})
export class TransitionSummaryModule {}
