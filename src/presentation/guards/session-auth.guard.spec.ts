import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SessionAuthGuard } from './session-auth.guard';
import { hashSessionToken } from '../../common/utils/session-token.util';

describe('SessionAuthGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let config: { get: jest.Mock };
  let dataSource: { query: jest.Mock };
  let guard: SessionAuthGuard;

  const contextWithHeaders = (
    headers: Record<string, string>,
  ): {
    context: ExecutionContext;
    request: { headers: Record<string, string> };
  } => {
    const request = { headers };
    const context = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { context, request };
  };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    config = { get: jest.fn().mockReturnValue(30) };
    dataSource = { query: jest.fn() };
    guard = new SessionAuthGuard(
      reflector as never,
      config as never,
      dataSource as never,
    );
  });

  it('lets public routes through without checking any token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const { context } = contextWithHeaders({});

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('rejects when there is no Authorization header', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const { context } = contextWithHeaders({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when the session does not match any active row', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    dataSource.query.mockResolvedValueOnce([]);
    const { context } = contextWithHeaders({ authorization: 'Bearer abc' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Sesión inválida o expirada',
    );
  });

  it('attaches req.user and slides the expiration forward on a valid session', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    dataSource.query
      .mockResolvedValueOnce([
        { SessionId: 'sess-1', UserId: 7, UserName: 'ana' },
      ])
      .mockResolvedValueOnce([]);
    const { context, request } = contextWithHeaders({
      authorization: 'Bearer my-raw-token',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect((request as unknown as { user: unknown }).user).toEqual({
      id: 7,
      userName: 'ana',
      sessionId: 'sess-1',
    });

    // La primera query valida contra el HASH del token, nunca el token crudo.
    const [, params] = dataSource.query.mock.calls[0] as [string, string[]];
    expect(params[0]).toBe(hashSessionToken('my-raw-token'));

    // La segunda query es el UPDATE que extiende ExpiresAt (sliding).
    const [updateSql, updateParams] = dataSource.query.mock.calls[1] as [
      string,
      unknown[],
    ];
    expect(updateSql).toContain('UPDATE "UserSession"');
    expect(updateParams).toEqual([30, 'sess-1']);
  });
});
