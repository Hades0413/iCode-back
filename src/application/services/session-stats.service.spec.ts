import { SessionStatsService } from './session-stats.service';

describe('SessionStatsService', () => {
  let dataSource: { query: jest.Mock };
  let config: { get: jest.Mock };
  let service: SessionStatsService;

  beforeEach(() => {
    dataSource = { query: jest.fn() };
    config = { get: jest.fn().mockReturnValue(15) };
    service = new SessionStatsService(dataSource as never, config as never);
  });

  it('returns zero counts and an empty list when nobody is online', async () => {
    dataSource.query.mockResolvedValue([]);

    const result = await service.getOnlineUsers();

    expect(result).toEqual({
      onlineUserCount: 0,
      onlineSessionCount: 0,
      sessions: [],
    });
  });

  it('counts distinct users separately from total sessions (multi-device)', async () => {
    dataSource.query.mockResolvedValue([
      {
        UserId: 1,
        UserName: 'ana',
        FirstName: 'Ana',
        LastName: 'Gómez',
        IpAddress: '8.8.8.8',
        UserAgent: 'jest',
        LastActivityAt: new Date(),
      },
      {
        // Misma usuaria, otra sesión (ej. celular + web) — mismo UserId.
        UserId: 1,
        UserName: 'ana',
        FirstName: 'Ana',
        LastName: 'Gómez',
        IpAddress: '1.1.1.1',
        UserAgent: 'jest-mobile',
        LastActivityAt: new Date(),
      },
    ]);

    const result = await service.getOnlineUsers();

    expect(result.onlineUserCount).toBe(1);
    expect(result.onlineSessionCount).toBe(2);
    expect(result.sessions).toHaveLength(2);
  });

  it('attaches a geolocation (or null) per session based on its IP', async () => {
    dataSource.query.mockResolvedValue([
      {
        UserId: 1,
        UserName: 'ana',
        FirstName: 'Ana',
        LastName: 'Gómez',
        IpAddress: '8.8.8.8',
        UserAgent: 'jest',
        LastActivityAt: new Date(),
      },
      {
        UserId: 2,
        UserName: 'local',
        FirstName: 'Local',
        LastName: 'User',
        IpAddress: '127.0.0.1',
        UserAgent: 'jest',
        LastActivityAt: new Date(),
      },
    ]);

    const result = await service.getOnlineUsers();

    expect(result.sessions[0].location).not.toBeNull();
    expect(result.sessions[1].location).toBeNull();
  });

  it('queries using the configured online threshold in minutes', async () => {
    config.get.mockReturnValue(42);
    dataSource.query.mockResolvedValue([]);

    await service.getOnlineUsers();

    expect(dataSource.query).toHaveBeenCalledWith(expect.any(String), [42]);
  });
});
