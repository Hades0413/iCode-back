import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: { check: jest.Mock };

  beforeEach(async () => {
    healthCheckService = { check: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: healthCheckService },
        { provide: TypeOrmHealthIndicator, useValue: { pingCheck: jest.fn() } },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('reports healthy when the database check passes', async () => {
    const result = {
      status: 'ok',
      info: { database: { status: 'up' } },
      error: {},
      details: { database: { status: 'up' } },
    };
    healthCheckService.check.mockResolvedValue(result);

    await expect(controller.check()).resolves.toEqual(result);
    expect(healthCheckService.check).toHaveBeenCalledWith([
      expect.any(Function),
    ]);
  });

  it('propagates the failure when the database check fails', async () => {
    healthCheckService.check.mockRejectedValue(new Error('db down'));

    await expect(controller.check()).rejects.toThrow('db down');
  });
});
