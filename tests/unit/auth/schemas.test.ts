import { describe, expect, it } from 'vitest';

import { ROLES } from '@/domains/auth/constants';
import { signInSchema, signUpSchema } from '@/domains/auth/schemas';

describe('ROLES', () => {
  it('exposes ADMIN and MERCHANT', () => {
    expect(ROLES).toEqual(['ADMIN', 'MERCHANT']);
  });
});

describe('signInSchema', () => {
  it.each([
    ['', 'Enter a valid email'],
    ['not-an-email', 'Enter a valid email'],
  ])('rejects invalid email %j', (email, message) => {
    const r = signInSchema.safeParse({ email, password: 'pass' });
    if (r.success) throw new Error('expected failure');
    expect(r.error.issues[0]?.message).toBe(message);
  });

  it('rejects empty password', () => {
    const r = signInSchema.safeParse({ email: 'a@b.com', password: '' });
    if (r.success) throw new Error('expected failure');
    expect(r.error.issues[0]?.message).toBe('Password is required');
  });

  it('accepts valid credentials', () => {
    const r = signInSchema.safeParse({ email: 'a@b.com', password: 'secret' });
    expect(r.success).toBe(true);
  });
});

describe('signUpSchema', () => {
  it('trims name', () => {
    const r = signUpSchema.safeParse({
      name: '  John  ',
      email: 'j@b.com',
      password: '12345678',
      businessName: 'Acme',
      phone: '+15551234567',
    });
    if (!r.success) throw new Error('expected success');
    expect(r.data.name).toBe('John');
  });

  it('rejects password under 8 chars', () => {
    const r = signUpSchema.safeParse({
      name: 'John',
      email: 'j@b.com',
      password: '1234567',
      businessName: 'Acme',
      phone: '+15551234567',
    });
    if (r.success) throw new Error('expected failure');
    expect(r.error.issues[0]?.message).toBe('Password must be at least 8 characters');
  });

  it('rejects password over 128 chars', () => {
    const r = signUpSchema.safeParse({
      name: 'John',
      email: 'j@b.com',
      password: '1'.repeat(129),
      businessName: 'Acme',
      phone: '+15551234567',
    });
    expect(r.success).toBe(false);
  });

  it('rejects businessName over 120 chars', () => {
    const r = signUpSchema.safeParse({
      name: 'John',
      email: 'j@b.com',
      password: '12345678',
      businessName: 'x'.repeat(121),
      phone: '+15551234567',
    });
    expect(r.success).toBe(false);
  });

  it('rejects missing businessName', () => {
    const r = signUpSchema.safeParse({
      name: 'John',
      email: 'j@b.com',
      password: '12345678',
      phone: '+15551234567',
    });
    expect(r.success).toBe(false);
  });

  it('rejects missing phone', () => {
    const r = signUpSchema.safeParse({
      name: 'John',
      email: 'j@b.com',
      password: '12345678',
      businessName: 'Acme',
    });
    expect(r.success).toBe(false);
  });

  it('rejects empty businessName', () => {
    const r = signUpSchema.safeParse({
      name: 'John',
      email: 'j@b.com',
      password: '12345678',
      businessName: '',
      phone: '+15551234567',
    });
    expect(r.success).toBe(false);
  });

  it('rejects empty phone', () => {
    const r = signUpSchema.safeParse({
      name: 'John',
      email: 'j@b.com',
      password: '12345678',
      businessName: 'Acme',
      phone: '',
    });
    expect(r.success).toBe(false);
  });
});
