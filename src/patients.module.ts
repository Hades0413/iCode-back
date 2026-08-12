import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from './domain/entities/patients/patient.entity';
import { LegalGuardian } from './domain/entities/patients/legal-guardian.entity';
import { PatientService } from './application/services/patients/patient.service';
import { TitleTransferService } from './application/services/patients/title-transfer.service';
import { PatientsController } from './presentation/controllers/patients.controller';
import { TransitionModule } from './transition.module';

/**
 * Dominio "paciente/tutor" — ver prompt_contexto_backend_puente18.md.
 * No importa nada del módulo de identidad más allá de las entidades que
 * necesita referenciar (User vía columnas UserId, no vía import de
 * AuthModule): un cambio acá nunca debería obligar a tocar login/roles,
 * ni al revés.
 *
 * Sí importa TransitionModule — única excepción, y por una razón de
 * Express, no de dominio: iCode-front llama literalmente a
 * "GET /patients/in-tutelage" y "GET /patients/post-transition" (ver
 * PatientsController), y esas dos rutas estáticas necesitan estar
 * declaradas ANTES de "GET /patients/:id" en la MISMA clase de
 * controller para no quedar sombreadas por ella sin importar el orden
 * en que Nest registre los módulos — ver
 * PUENTE18_FRONTEND_INTEGRATION.md, sección 2. Esto no crea un ciclo:
 * TransitionModule no depende de PatientsModule (el cálculo de edad
 * compartido es una función pura, ver common/utils/age.util.ts).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Patient, LegalGuardian]),
    TransitionModule,
  ],
  controllers: [PatientsController],
  providers: [PatientService, TitleTransferService],
  exports: [PatientService, TitleTransferService],
})
export class PatientsModule {}
