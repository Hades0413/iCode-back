import { Request, Response } from 'express';
import { SanitizeMiddleware } from './sanitize.middleware';

describe('SanitizeMiddleware', () => {
  const middleware = new SanitizeMiddleware();

  it('sanitizes req.body in place', () => {
    const req = {
      body: { name: '  <script>alert(1)</script>Ana  ' },
    } as unknown as Request;
    const next = jest.fn();

    middleware.use(req, {} as Response, next);

    expect(req.body).toEqual({ name: 'Ana' });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does nothing when there is no body (e.g. a GET request)', () => {
    const req = {} as Request;
    const next = jest.fn();

    expect(() => middleware.use(req, {} as Response, next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
