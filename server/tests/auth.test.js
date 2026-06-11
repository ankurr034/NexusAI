import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// These tests lock in the security primitives the auth layer now relies on.
const SECRET = 'test_secret_for_unit_tests_only';

describe('password hashing (bcrypt)', () => {
  it('never stores the plaintext password', async () => {
    const hash = await bcrypt.hash('hunter2', 10);
    expect(hash).not.toContain('hunter2');
    expect(hash.startsWith('$2')).toBe(true); // bcrypt hash signature
  });

  it('verifies the correct password and rejects a wrong one', async () => {
    const hash = await bcrypt.hash('correct-horse', 10);
    expect(await bcrypt.compare('correct-horse', hash)).toBe(true);
    expect(await bcrypt.compare('wrong-password', hash)).toBe(false);
  });

  it('produces a different hash each time (salted)', async () => {
    const a = await bcrypt.hash('samepass', 10);
    const b = await bcrypt.hash('samepass', 10);
    expect(a).not.toBe(b);
  });
});

describe('JWT issue / verify', () => {
  it('round-trips a valid token', () => {
    const token = jwt.sign({ id: 'abc', isPremium: true }, SECRET, { expiresIn: '7d' });
    const decoded = jwt.verify(token, SECRET);
    expect(decoded.id).toBe('abc');
    expect(decoded.isPremium).toBe(true);
  });

  it('rejects a token signed with a different secret', () => {
    const token = jwt.sign({ id: 'abc' }, 'other_secret');
    expect(() => jwt.verify(token, SECRET)).toThrow();
  });

  it('rejects a tampered token', () => {
    const token = jwt.sign({ id: 'abc' }, SECRET);
    const tampered = token.slice(0, -2) + (token.endsWith('a') ? 'bb' : 'aa');
    expect(() => jwt.verify(tampered, SECRET)).toThrow();
  });
});
