import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { extname } from 'node:path';
import { In, Repository } from 'typeorm';
import { PatientAttachment } from '../../../domain/entities/patients/patient-attachment.entity';
import { User } from '../../../domain/entities/user.entity';
import { PatientAttachmentStorageService } from './patient-attachment-storage.service';
import { PatientAttachmentResponseDto } from '../../dto/patients/patient-attachment-response.dto';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.pdf',
  '.doc',
  '.docx',
  '.mp4',
  '.mov',
  '.webm',
]);

/**
 * "Exámenes y documentos" — imágenes, PDF, Word o video sueltos del
 * caso, muchos por paciente (a diferencia de la historia clínica o la
 * carta de contrarreferencia, que son 1:1). Sin ciclo de vida propio:
 * se suben y se listan, nada más.
 */
@Injectable()
export class PatientAttachmentService {
  constructor(
    @InjectRepository(PatientAttachment)
    private readonly attachmentRepository: Repository<PatientAttachment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly storageService: PatientAttachmentStorageService,
  ) {}

  async findByPatient(
    patientId: number,
  ): Promise<PatientAttachmentResponseDto[]> {
    const attachments = await this.attachmentRepository.find({
      where: { patientId },
      order: { uploadedAt: 'DESC' },
    });
    const userIds = [...new Set(attachments.map((a) => a.uploadedById))];
    const users =
      userIds.length > 0
        ? await this.userRepository.find({ where: { id: In(userIds) } })
        : [];
    const nameById = new Map(
      users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]),
    );
    return attachments.map((a) => this.toResponseDto(a, nameById));
  }

  async upload(
    patientId: number,
    file: Express.Multer.File,
    currentUserId: number,
  ): Promise<PatientAttachmentResponseDto> {
    this.assertValidFile(file);
    const storagePath = await this.storageService.save(
      patientId,
      file.originalname,
      file.buffer,
    );
    const now = new Date();
    const attachment = this.attachmentRepository.create({
      patientId,
      fileName: file.originalname,
      fileSize: file.size,
      storagePath,
      uploadedById: currentUserId,
      uploadedAt: now,
      createdAt: now,
      createdById: currentUserId,
    });
    const saved = await this.attachmentRepository.save(attachment);
    const user = await this.userRepository.findOne({
      where: { id: currentUserId },
    });
    const name = user ? `${user.firstName} ${user.lastName}`.trim() : '';
    return this.toResponseDto(saved, new Map([[currentUserId, name]]));
  }

  async getOrFail(
    patientId: number,
    attachmentId: number,
  ): Promise<PatientAttachment> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId, patientId },
    });
    if (!attachment) {
      throw new NotFoundException('No se encontró ese adjunto');
    }
    return attachment;
  }

  resolveDocumentPath(attachment: PatientAttachment): string {
    return this.storageService.resolveAbsolutePath(attachment.storagePath);
  }

  /**
   * "Quitar" — soft delete (ver AuditableEntity): el archivo queda en disco
   * y la fila en la tabla, solo deja de listarse. Un examen o informe ya
   * adjuntado al caso no se destruye por un click, a diferencia de
   * "Descartar borrador" que sí es una fila entera sin firmar.
   */
  async remove(
    patientId: number,
    attachmentId: number,
    currentUserId: number,
  ): Promise<void> {
    const attachment = await this.getOrFail(patientId, attachmentId);
    attachment.deletedAt = new Date();
    attachment.deletedById = currentUserId;
    await this.attachmentRepository.save(attachment);
  }

  private assertValidFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('Falta el archivo a adjuntar');
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('El archivo supera los 25 MB permitidos');
    }
    if (!ALLOWED_EXTENSIONS.has(extname(file.originalname).toLowerCase())) {
      throw new BadRequestException(
        'Formato no permitido — usá imagen, PDF, Word o video',
      );
    }
  }

  private toResponseDto(
    attachment: PatientAttachment,
    nameById: Map<number, string>,
  ): PatientAttachmentResponseDto {
    return {
      id: String(attachment.id),
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
      uploadedBy: nameById.get(attachment.uploadedById) ?? '',
      uploadedAt: attachment.uploadedAt.toISOString(),
    };
  }
}
