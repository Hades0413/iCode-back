import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * "Exámenes y documentos" de la ficha del paciente — imágenes, PDF,
 * Word o video sueltos, aparte de la historia clínica y la carta.
 * Mismo patrón de disco local que CounterReferralStorageService.
 */
@Injectable()
export class PatientAttachmentStorageService {
  constructor(private readonly configService: ConfigService) {}

  async save(
    patientId: number,
    originalFileName: string,
    buffer: Buffer,
  ): Promise<string> {
    const dir = join(this.basePath(), String(patientId));
    await mkdir(dir, { recursive: true });
    const safeName = `${randomUUID()}-${basename(originalFileName)}`;
    await writeFile(join(dir, safeName), buffer);
    return join(String(patientId), safeName);
  }

  resolveAbsolutePath(storagePath: string): string {
    return join(this.basePath(), storagePath);
  }

  private basePath(): string {
    return this.configService.get<string>(
      'app.patientAttachmentStoragePath',
      './storage/attachments',
    );
  }
}
