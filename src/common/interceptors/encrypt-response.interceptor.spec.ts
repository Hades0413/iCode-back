import { randomBytes } from 'node:crypto';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { EncryptResponseInterceptor } from './encrypt-response.interceptor';
import { decryptPayload, EncryptedPayload } from '../utils/encryption.util';

describe('EncryptResponseInterceptor', () => {
  const key = randomBytes(32).toString('hex');
  let reflector: { get: jest.Mock };
  let config: { get: jest.Mock };
  let interceptor: EncryptResponseInterceptor;
  let context: ExecutionContext;

  const nextReturning = (value: unknown): CallHandler => ({
    handle: () => of(value),
  });

  beforeEach(() => {
    reflector = { get: jest.fn() };
    config = { get: jest.fn() };
    interceptor = new EncryptResponseInterceptor(
      reflector as never,
      config as never,
    );
    context = { getHandler: () => undefined } as unknown as ExecutionContext;
  });

  it('passes through untouched when the handler has no @EncryptResponse()', async () => {
    reflector.get.mockReturnValue(false);

    const result = await firstValueFrom(
      interceptor.intercept(context, nextReturning({ hello: 'world' })),
    );

    expect(result).toEqual({ hello: 'world' });
  });

  it('encrypts the response when the handler has @EncryptResponse()', async () => {
    reflector.get.mockReturnValue(true);
    config.get.mockReturnValue(key);

    const result = (await firstValueFrom(
      interceptor.intercept(context, nextReturning({ hello: 'world' })),
    )) as EncryptedPayload;

    expect(result).toHaveProperty('iv');
    expect(result).toHaveProperty('authTag');
    expect(result).toHaveProperty('data');
    expect(JSON.parse(decryptPayload(result, key))).toEqual({
      hello: 'world',
    });
  });

  it('throws when the encryption key is missing or invalid', () => {
    reflector.get.mockReturnValue(true);
    config.get.mockReturnValue(undefined);

    expect(() =>
      interceptor.intercept(context, nextReturning({ hello: 'world' })),
    ).toThrow('RESPONSE_ENCRYPTION_KEY');
  });
});
