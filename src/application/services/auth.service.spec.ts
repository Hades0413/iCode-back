import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { hashPassword } from '../../common/utils/password-hashing.util';

describe('AuthService', () => {
  let userRepository: { findOne: jest.Mock; update: jest.Mock };
  let sessionRepository: {
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let dataSource: { query: jest.Mock };
  let config: { get: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    userRepository = { findOne: jest.fn(), update: jest.fn() };
    sessionRepository = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn(),
      update: jest.fn(),
    };
    dataSource = { query: jest.fn() };
    config = { get: jest.fn().mockReturnValue(30) };

    service = new AuthService(
      userRepository as never,
      sessionRepository as never,
      dataSource as never,
      config as never,
    );
  });

  describe('login', () => {
    it('rejects when the user does not exist, with a generic message', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.login('nadie', 'x', {})).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login('nadie', 'x', {})).rejects.toThrow(
        'Usuario o contraseña inválidos',
      );
    });

    it('rejects when the user is disabled (State = false)', async () => {
      const { hash, salt } = await hashPassword('correcta');
      userRepository.findOne.mockResolvedValue({
        id: 1,
        state: false,
        passwordHash: hash,
        passwordSalt: salt,
      });

      await expect(service.login('user', 'correcta', {})).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects the wrong password with the same generic message', async () => {
      const { hash, salt } = await hashPassword('correcta');
      userRepository.findOne.mockResolvedValue({
        id: 1,
        state: true,
        passwordHash: hash,
        passwordSalt: salt,
      });

      await expect(service.login('user', 'incorrecta', {})).rejects.toThrow(
        'Usuario o contraseña inválidos',
      );
      expect(sessionRepository.save).not.toHaveBeenCalled();
    });

    it('creates a session and returns an opaque token on success', async () => {
      const { hash, salt } = await hashPassword('correcta');
      userRepository.findOne.mockResolvedValue({
        id: 1,
        userName: 'user',
        state: true,
        passwordHash: hash,
        passwordSalt: salt,
      });
      let savedSession: { tokenHash: string } | undefined;
      sessionRepository.save.mockImplementation((session: unknown) => {
        savedSession = session as { tokenHash: string };
        return Promise.resolve(session);
      });

      const result = await service.login('user', 'correcta', {
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      });

      expect(result.tokenType).toBe('Bearer');
      expect(result.accessToken).toHaveLength(64);
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(sessionRepository.save).toHaveBeenCalledTimes(1);
      expect(userRepository.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ lastLoginAt: expect.any(Date) as Date }),
      );

      // El hash guardado nunca es el token que se devuelve al cliente.
      expect(savedSession?.tokenHash).not.toBe(result.accessToken);
    });
  });

  describe('logout', () => {
    it('revokes only the given session id', async () => {
      await service.logout('session-123');

      expect(sessionRepository.update).toHaveBeenCalledWith(
        'session-123',
        expect.objectContaining({ revokedAt: expect.any(Date) as Date }),
      );
    });
  });

  describe('getProfile', () => {
    it('throws when the user no longer exists', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getProfile(999)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('returns the profile with effective permission codes, never the password fields', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 1,
        userName: 'user',
        email: 'user@example.com',
        firstName: 'Ana',
        lastName: 'Gómez',
        passwordHash: Buffer.from('should-not-leak'),
        passwordSalt: Buffer.from('should-not-leak'),
      });
      dataSource.query.mockResolvedValue([
        { PermissionCode: 'INV_READ' },
        { PermissionCode: 'REP_VIEW' },
      ]);

      const profile = await service.getProfile(1);

      expect(profile).toEqual({
        id: 1,
        userName: 'user',
        email: 'user@example.com',
        firstName: 'Ana',
        lastName: 'Gómez',
        permissions: ['INV_READ', 'REP_VIEW'],
      });
      expect(profile).not.toHaveProperty('passwordHash');
      expect(profile).not.toHaveProperty('passwordSalt');
    });
  });
});
