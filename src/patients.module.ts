import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from './domain/entities/patients/patient.entity';
import { LegalGuardian } from './domain/entities/patients/legal-guardian.entity';
import { PatientService } from './application/services/patients/patient.service';
import { TitleTransferService } from './application/services/patients/title-transfer.service';
import { PatientsController } from './presentation/controllers/patients.controller';

/**
 * Dominio "paciente/tutor" — ver prompt_contexto_backend_puente18.md.
 * No importa nada del módulo de identidad más allá de las entidades que
 * necesita referenciar (User vía columnas UserId, no vía import de
 * AuthModule): un cambio acá nunca debería obligar a tocar login/roles,
 * ni al revés.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Patient, LegalGuardian])],
  controllers: [PatientsController],
  providers: [PatientService, TitleTransferService],
  exports: [PatientService, TitleTransferService],
})
export class PatientsModule {}
