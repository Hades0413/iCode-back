import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientAttachment } from './domain/entities/patients/patient-attachment.entity';
import { User } from './domain/entities/user.entity';
import { PatientAttachmentService } from './application/services/patients/patient-attachment.service';
import { PatientAttachmentStorageService } from './application/services/patients/patient-attachment-storage.service';
import { PatientAttachmentsController } from './presentation/controllers/patient-attachments.controller';

/** "Exámenes y documentos" de la ficha del paciente — ver PatientAttachmentService. */
@Module({
  imports: [TypeOrmModule.forFeature([PatientAttachment, User])],
  controllers: [PatientAttachmentsController],
  providers: [PatientAttachmentService, PatientAttachmentStorageService],
  exports: [PatientAttachmentService],
})
export class PatientAttachmentModule {}
