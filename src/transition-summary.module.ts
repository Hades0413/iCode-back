import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransitionSummary } from './domain/entities/clinical/transition-summary.entity';
import { ClinicalRecord } from './domain/entities/clinical/clinical-record.entity';
import { User } from './domain/entities/user.entity';
import { TransitionSummaryService } from './application/services/clinical/transition-summary.service';
import { OpenAiSummaryDraftingService } from './application/services/clinical/openai-summary-drafting.service';
import { TransitionSummaryStorageService } from './application/services/clinical/transition-summary-storage.service';
import { TransitionSummariesController } from './presentation/controllers/transition-summaries.controller';
import { TransitionModule } from './transition.module';

/**
 * La historia clínica de transferencia — depende de TransitionModule
 * (setState/assertSpecialtyMatches/findDetail/getRuleContext), nunca al
 * revés. Ver PUENTE18_FRONTEND_INTEGRATION.md, sección 3.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([TransitionSummary, ClinicalRecord, User]),
    TransitionModule,
  ],
  controllers: [TransitionSummariesController],
  providers: [
    TransitionSummaryService,
    OpenAiSummaryDraftingService,
    TransitionSummaryStorageService,
  ],
  exports: [TransitionSummaryService],
})
export class TransitionSummaryModule {}
