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
import { ReferralReview } from './domain/entities/referrals/referral-review.entity';
import { JourneyChecklistItem } from './domain/entities/journey/journey-checklist-item.entity';
import { User } from './domain/entities/user.entity';
import { PatientTransitionService } from './application/services/transition/patient-transition.service';
import { PatientTransitionsController } from './presentation/controllers/patient-transitions.controller';

/**
 * Dominio "recorrido pediátrico→adultos" que consume iCode-front — ver
 * PUENTE18_FRONTEND_INTEGRATION.md. NO importa PatientsModule (a
 * propósito, ver common/utils/age.util.ts): el cálculo de edad es una
 * función pura compartida sin acoplar los dos módulos entre sí, así
 * PatientsModule puede importar a ESTE (para las rutas
 * "/patients/in-tutelage" y "/patients/post-transition" en
 * PatientsController, ver ese módulo) sin crear un ciclo.
 *
 * TransitionSummaryModule/ReferralModule/CounterReferralModule/JourneyModule
 * (los módulos "de escritura" de esos dominios) importan a ESTE para usar
 * "setState"/"assertSpecialtyMatches" — la dependencia va de ellos hacia
 * acá, nunca al revés. Este módulo sí registra entidades de otros
 * dominios vía "forFeature" (sin importar sus módulos) para poder leerlas
 * al armar "lastAction"/"summaryStatus"/"checklistProgress"/nombres
 * resueltos en la cohorte — mismo patrón que ConsentModule leyendo
 * "Patient" sin depender de quien lo escribe.
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
      ReferralReview,
      JourneyChecklistItem,
      User,
    ]),
  ],
  controllers: [PatientTransitionsController],
  providers: [PatientTransitionService],
  exports: [PatientTransitionService],
})
export class TransitionModule {}
