import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PermissionGuard } from './permission.guard';

describe('PermissionGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let dataSource: { query: jest.Mock };
  let guard: PermissionGuard;

  const contextWithUser = (user: unknown): ExecutionContext =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    dataSource = { query: jest.fn() };
    guard = new PermissionGuard(reflector as never, dataSource as never);
  });

  it('allows the request through when the route has no @RequirePermission()', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(contextWithUser(undefined))).resolves.toBe(
      true,
    );
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('rejects when there is no authenticated user', async () => {
    reflector.getAllAndOverride.mockReturnValue('USR_WRITE');

    await expect(guard.canActivate(contextWithUser(undefined))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows the request when UserPermission has a matching row', async () => {
    reflector.getAllAndOverride.mockReturnValue('USR_WRITE');
    dataSource.query.mockResolvedValue([{}]);

    await expect(guard.canActivate(contextWithUser({ id: 1 }))).resolves.toBe(
      true,
    );
    expect(dataSource.query).toHaveBeenCalledWith(expect.any(String), [
      1,
      'USR_WRITE',
    ]);
  });

  it('rejects when UserPermission has no matching row', async () => {
    reflector.getAllAndOverride.mockReturnValue('USR_WRITE');
    dataSource.query.mockResolvedValue([]);

    await expect(guard.canActivate(contextWithUser({ id: 1 }))).rejects.toThrow(
      'Falta el permiso USR_WRITE',
    );
  });
});
