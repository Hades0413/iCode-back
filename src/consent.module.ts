import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessAuthorization } from './domain/entities/consent/access-authorization.entity';
import { ClinicalAccessLog } from './domain/entities/consent/clinical-access-log.entity';
import { Patient } from './domain/entities/patients/patient.entity';
import { HealthFacilityStaff } from './domain/entities/facilities/health-facility-staff.entity';
import { ConsentService } from './application/services/consent/consent.service';
import { AccessDecisionService } from './application/services/consent/access-decision.service';
import { ClinicalAccessLogService } from './application/services/consent/clinical-access-log.service';
import { HealthFacilityAccessService } from './application/services/consent/health-facility-access.service';
import { ConsentController } from './presentation/controllers/consent.controller';
import { HealthFacilityAccessController } from './presentation/controllers/health-facility-access.controller';
import { PatientsModule } from './patients.module';
import { ClinicalRecordsModule } from './clinical-records.module';

/**
 * Dominio "consentimiento y trazabilidad de accesos" — el más
 * dependiente de los tres (necesita a los otros dos para decidir y
 * responder), pero la dependencia sigue siendo de un solo sentido:
 * PatientsModule y ClinicalRecordsModule no saben que esto existe.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccessAuthorization,
      ClinicalAccessLog,
      Patient,
      HealthFacilityStaff,
    ]),
    PatientsModule,
    ClinicalRecordsModule,
  ],
  controllers: [ConsentController, HealthFacilityAccessController],
  providers: [
    ConsentService,
    AccessDecisionService,
    ClinicalAccessLogService,
    HealthFacilityAccessService,
  ],
})
export class ConsentModule {}
