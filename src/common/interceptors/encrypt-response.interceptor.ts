import {
  CallHandler,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ENCRYPT_RESPONSE_KEY } from '../decorators/encrypt-response.decorator';
import { encryptPayload, isValidEncryptionKey } from '../utils/encryption.util';

/**
 * Registrado globalmente pero inerte: solo cifra si el handler tiene
 * @EncryptResponse(). HTTPS (nginx, ver docker/nginx/nginx.conf) YA cifra
 * todo el tráfico en tránsito — esto es una capa EXTRA para el caso
 * puntual de necesitar que el payload en sí quede ilegible más allá de
 * eso (ej. un requisito regulatorio puntual, o un proxy intermedio en el
 * que no confiás del todo). No lo actives por default en todo: rompe
 * "Try it out" de Swagger y cualquier cliente necesita la misma key para
 * descifrar — para el 99% de los endpoints, TLS solo ya alcanza.
 */
@Injectable()
export class EncryptResponseInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const shouldEncrypt = this.reflector.get<boolean>(
      ENCRYPT_RESPONSE_KEY,
      context.getHandler(),
    );

    if (!shouldEncrypt) {
      return next.handle();
    }

    const key = this.config.get<string>('app.responseEncryptionKey');
    if (!isValidEncryptionKey(key)) {
      throw new InternalServerErrorException(
        'RESPONSE_ENCRYPTION_KEY inválida o no configurada: hace falta un valor hex de 64 caracteres para usar @EncryptResponse()',
      );
    }

    return next
      .handle()
      .pipe(
        map((body: unknown) =>
          encryptPayload(JSON.stringify(body ?? null), key),
        ),
      );
  }
}
