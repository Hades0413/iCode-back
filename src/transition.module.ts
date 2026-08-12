import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientTransition } from './domain/entities/patients/patient-transition.entity';
import { Patient } from './domain/entities/patients/patient.entity';
import { MedicalSpecialty } from './domain/entities/facilities/medical-specialty.entity';
import { HealthFacilityStaff } from './domain/entities/facilities/health-facility-staff.entity';
import { HealthFacilityStaffSpecialty } from './domain/entities/facilities/health-facility-staff-specialty.entity';
import { HealthFacility } from './domain/entities/facilities/health-facility.entity';
import { TransitionSummary } from './domain/entities/clinical/transition-summary.entity';
import { PostNotice } from './domain/entities/referrals/post-notice.entity';
import { ReferralAlert } from './domain/entities/referrals/referral-alert.entity';
import { CounterReferral } from './domain/entities/referrals/counter-referral.entity';
import { PatientTransitionService } from './application/services/transition/patient-transition.service';
import { PatientTransitionsController } from './presentation/controllers/patient-transitions.controller';
import { PatientsModule } from './patients.module';

/**
 * Dominio "recorrido pediátrico→adultos" que consume iCode-front — ver
 * PUENTE18_FRONTEND_INTEGRATION.md. Importa PatientsModule (solo para
 * TitleTransferService, mismo criterio que ClinicalRecordsModule) pero
 * PatientsModule nunca sabe que esto existe.
 *
 * TransitionSummaryModule/ReferralModule/CounterReferralModule/JourneyModule
 * (los módulos "de escritura" de esos dominios) importan a ESTE para usar
 * "setState"/"assertSpecialtyMatches" — la dependencia va de ellos hacia
 * acá, nunca al revés. Este módulo sí registra sus entidades vía
 * "forFeature" (sin importar esos módulos) para poder leerlas al armar
 * "lastAction"/"summaryStatus" en la cohorte — mismo patrón que
 * ConsentModule leyendo "Patient" sin depender de quien lo escribe.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PatientTransition,
      Patient,
      MedicalSpecialty,
      HealthFacilityStaff,
      HealthFacilityStaffSpecialty,
      HealthFacility,
      TransitionSummary,
      PostNotice,
      ReferralAlert,
      CounterReferral,
    ]),
    PatientsModule,
  ],
  controllers: [PatientTransitionsController],
  providers: [PatientTransitionService],
  exports: [PatientTransitionService],
})
export class TransitionModule {}
