import { ExecutionContext } from '@nestjs/common';
import { sanitizedQueryFactory } from './sanitized-query.decorator';

describe('sanitizedQueryFactory', () => {
  const contextWithQuery = (query: Record<string, unknown>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ query }),
      }),
    }) as unknown as ExecutionContext;

  it('returns the whole query sanitized when no key is given', () => {
    const ctx = contextWithQuery({ name: '<b>Ana</b>', age: '30' });

    expect(sanitizedQueryFactory(undefined, ctx)).toEqual({
      name: 'Ana',
      age: '30',
    });
  });

  it('returns a single sanitized field when a key is given', () => {
    const ctx = contextWithQuery({ name: '<script>x</script>Ana' });

    expect(sanitizedQueryFactory('name', ctx)).toBe('Ana');
  });
});
