import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from './domain/entities/patients/patient.entity';
import { LegalGuardian } from './domain/entities/patients/legal-guardian.entity';
import { PatientTransition } from './domain/entities/patients/patient-transition.entity';
import { JourneyChecklistItem } from './domain/entities/journey/journey-checklist-item.entity';
import { JourneyMedication } from './domain/entities/journey/journey-medication.entity';
import { JourneyAllergy } from './domain/entities/journey/journey-allergy.entity';
import { JourneyContact } from './domain/entities/journey/journey-contact.entity';
import { JourneyGuideEntry } from './domain/entities/journey/journey-guide-entry.entity';
import { JourneyMessage } from './domain/entities/journey/journey-message.entity';
import { User } from './domain/entities/user.entity';
import { JourneyService } from './application/services/journey/journey.service';
import { JourneyController } from './presentation/controllers/journey.controller';
import { TransitionModule } from './transition.module';

/**
 * "Mi recorrido" — depende de TransitionModule (findDetail), nunca al
 * revés. Lee "User" solo para mostrarle al paciente el nombre de quien
 * lo acompaña — excepción deliberada al resto del dominio (que expone
 * ids crudos, no nombres): ver JourneyService y
 * PUENTE18_FRONTEND_INTEGRATION.md, sección 6.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      LegalGuardian,
      PatientTransition,
      JourneyChecklistItem,
      JourneyMedication,
      JourneyAllergy,
      JourneyContact,
      JourneyGuideEntry,
      JourneyMessage,
      User,
    ]),
    TransitionModule,
  ],
  controllers: [JourneyController],
  providers: [JourneyService],
})
export class JourneyModule {}
