import { generateSessionToken, hashSessionToken } from './session-token.util';

describe('session-token.util', () => {
  it('generates a high-entropy, unique token on every call', () => {
    const a = generateSessionToken();
    const b = generateSessionToken();

    expect(a).not.toBe(b);
    expect(a).toHaveLength(64); // 32 bytes en hex
  });

  it('hashes deterministically (same input -> same hash)', () => {
    const token = generateSessionToken();

    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });

  it('produces different hashes for different tokens', () => {
    const a = generateSessionToken();
    const b = generateSessionToken();

    expect(hashSessionToken(a)).not.toBe(hashSessionToken(b));
  });
});
