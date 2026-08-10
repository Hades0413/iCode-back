import { paginate } from './paginate.util';

describe('paginate', () => {
  it('builds meta from total/page/limit', () => {
    const result = paginate(['a', 'b'], 45, { page: 2, limit: 20 });

    expect(result).toEqual({
      data: ['a', 'b'],
      meta: { total: 45, page: 2, limit: 20, totalPages: 3 },
    });
  });

  it('reports zero total pages when there are no results', () => {
    const result = paginate([], 0, { page: 1, limit: 20 });

    expect(result.meta.totalPages).toBe(0);
  });

  it('rounds totalPages up, never down', () => {
    const result = paginate([], 21, { page: 1, limit: 20 });

    expect(result.meta.totalPages).toBe(2);
  });
});
