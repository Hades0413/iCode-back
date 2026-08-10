import { hashPassword, verifyPassword } from './password-hashing.util';

describe('password-hashing.util', () => {
  it('verifies the correct password against its own hash+salt', async () => {
    const { hash, salt } = await hashPassword('correct horse battery staple');

    await expect(
      verifyPassword('correct horse battery staple', hash, salt),
    ).resolves.toBe(true);
  });

  it('rejects the wrong password', async () => {
    const { hash, salt } = await hashPassword('correct horse battery staple');

    await expect(verifyPassword('wrong password', hash, salt)).resolves.toBe(
      false,
    );
  });

  it('produces a different salt (and hash) on every call', async () => {
    const a = await hashPassword('same password');
    const b = await hashPassword('same password');

    expect(a.salt.equals(b.salt)).toBe(false);
    expect(a.hash.equals(b.hash)).toBe(false);
  });

  it('stores hash and salt as 32 and 16 bytes respectively', async () => {
    const { hash, salt } = await hashPassword('anything');

    expect(hash).toHaveLength(32);
    expect(salt).toHaveLength(16);
  });
});
