import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Dónde vive el documento original de "Subir el documento" — mismo
 * patrón de disco local que CounterReferralStorageService, en su propia
 * carpeta (reutiliza la carpeta de la carta sería mezclar dos ciclos de
 * vida distintos).
 */
@Injectable()
export class TransitionSummaryStorageService {
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
      'app.transitionSummaryStoragePath',
      './storage/transition-summaries',
    );
  }
}
