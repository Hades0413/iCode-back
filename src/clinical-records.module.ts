import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicalRecord } from './domain/entities/clinical/clinical-record.entity';
import { Patient } from './domain/entities/patients/patient.entity';
import { ClinicalRecordService } from './application/services/clinical/clinical-record.service';
import { TransitionFileService } from './application/services/clinical/transition-file.service';
import { ClinicalRecordsController } from './presentation/controllers/clinical-records.controller';
import { PatientsModule } from './patients.module';

/**
 * Dominio "historial clínico resumido" — depende de PatientsModule (solo
 * para TitleTransferService.isAdult, ver TransitionFileService) pero
 * PatientsModule nunca depende de esto: la dependencia es de un solo
 * sentido, así un cambio acá no puede romper el módulo de pacientes.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ClinicalRecord, Patient]),
    PatientsModule,
  ],
  controllers: [ClinicalRecordsController],
  providers: [ClinicalRecordService, TransitionFileService],
  exports: [ClinicalRecordService],
})
export class ClinicalRecordsModule {}
