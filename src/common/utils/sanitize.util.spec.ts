import { sanitizeValue } from './sanitize.util';

describe('sanitizeValue', () => {
  it('trims whitespace and strips HTML tags from strings', () => {
    expect(sanitizeValue('  hola  ')).toBe('hola');
    expect(sanitizeValue('<script>alert(1)</script>hola')).toBe('hola');
    expect(sanitizeValue('<b>hola</b>')).toBe('hola');
  });

  it('recurses into arrays', () => {
    expect(sanitizeValue(['<i>a</i>', '  b  '])).toEqual(['a', 'b']);
  });

  it('recurses into nested objects without dropping keys', () => {
    const input = {
      name: '  <b>Ana</b>  ',
      address: { city: '<script>x</script>Lima', zip: '00001' },
      age: 30,
      active: true,
    };

    expect(sanitizeValue(input)).toEqual({
      name: 'Ana',
      address: { city: 'Lima', zip: '00001' },
      age: 30,
      active: true,
    });
  });

  it('leaves non-string primitives and null untouched', () => {
    expect(sanitizeValue(42)).toBe(42);
    expect(sanitizeValue(true)).toBe(true);
    expect(sanitizeValue(null)).toBeNull();
  });
});
