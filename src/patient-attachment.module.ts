import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientAttachment } from './domain/entities/patients/patient-attachment.entity';
import { User } from './domain/entities/user.entity';
import { PatientAttachmentService } from './application/services/patients/patient-attachment.service';
import { PatientAttachmentStorageService } from './application/services/patients/patient-attachment-storage.service';
import { PatientAttachmentsController } from './presentation/controllers/patient-attachments.controller';
import { TransitionModule } from './transition.module';

/**
 * "Exámenes y documentos" de la ficha del paciente — ver
 * PatientAttachmentService. Importa TransitionModule (para resolver el
 * código de "pase de consulta", mismo criterio que TransitionSummaryModule
 * — ver PUENTE18_FRONTEND_INTEGRATION.md, sección 3), nunca al revés.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([PatientAttachment, User]),
    TransitionModule,
  ],
  controllers: [PatientAttachmentsController],
  providers: [PatientAttachmentService, PatientAttachmentStorageService],
  exports: [PatientAttachmentService],
})
export class PatientAttachmentModule {}
