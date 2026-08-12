import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Único punto que sabe DÓNDE vive el binario de la carta — disco local
 * en un volumen Docker (decisión registrada en
 * PUENTE18_FRONTEND_INTEGRATION.md, swap-eable a S3-compatible después
 * sin tocar CounterReferralService, que solo conoce "StoragePath").
 */
@Injectable()
export class CounterReferralStorageService {
  constructor(private readonly configService: ConfigService) {}

  /** Devuelve la ruta RELATIVA a guardar en "CounterReferral.StoragePath" — nunca la ruta absoluta del disco. */
  async save(
    patientId: number,
    originalFileName: string,
    buffer: Buffer,
  ): Promise<string> {
    const dir = join(this.basePath(), String(patientId));
    await mkdir(dir, { recursive: true });
    // "basename" descarta cualquier segmento de directorio del nombre
    // original (path traversal) — nunca se confía en el nombre que manda
    // el cliente para construir una ruta de disco.
    const safeName = `${randomUUID()}-${basename(originalFileName)}`;
    await writeFile(join(dir, safeName), buffer);
    return join(String(patientId), safeName);
  }

  resolveAbsolutePath(storagePath: string): string {
    return join(this.basePath(), storagePath);
  }

  private basePath(): string {
    return this.configService.get<string>(
      'app.counterReferralStoragePath',
      './storage/counter-referrals',
    );
  }
}
