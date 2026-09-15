import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  update: vi.fn(() => ({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) })),
  insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
}));

vi.mock('@/db', () => ({
  getDb: () => ({ update: dbMocks.update, insert: dbMocks.insert }),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      signInEmail: vi.fn(),
      signUpEmail: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));

import { signInAction, signOutAction, signUpAction } from '@/domains/auth/server/actions';
import { auth } from '@/lib/auth';

const signInEmail = () => vi.mocked(auth.api.signInEmail);
const signUpEmail = () => vi.mocked(auth.api.signUpEmail);
const signOut = () => vi.mocked(auth.api.signOut);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('signInAction', () => {
  it('fails invalid schema without calling auth', async () => {
    const result = await signInAction({ email: 'bad', password: '' } as never);
    expect(result).toEqual({ ok: false, error: 'Enter valid credentials' });
    expect(signInEmail()).not.toHaveBeenCalled();
  });

  it('returns ok with default MERCHANT role', async () => {
    signInEmail().mockResolvedValueOnce({ user: { id: 'u1' } } as never);
    const result = await signInAction({ email: 'a@b.com', password: 'pass' });
    expect(result).toEqual({ ok: true, data: { role: 'MERCHANT' } });
  });

  it('returns the role from the authenticated user', async () => {
    signInEmail().mockResolvedValueOnce({ user: { id: 'u1', role: 'ADMIN' } } as never);
    const result = await signInAction({ email: 'a@b.com', password: 'pass' });
    expect(result).toEqual({ ok: true, data: { role: 'ADMIN' } });
  });

  it('fails when authenticated user is falsy', async () => {
    signInEmail().mockResolvedValueOnce({ user: null } as never);
    const result = await signInAction({ email: 'a@b.com', password: 'pass' });
    expect(result).toEqual({ ok: false, error: 'Sign in failed' });
  });

  it('fails with thrown error message', async () => {
    signInEmail().mockRejectedValueOnce(new Error('ratelimited'));
    const result = await signInAction({ email: 'a@b.com', password: 'pass' });
    expect(result).toEqual({ ok: false, error: 'ratelimited' });
  });

  it('fails with generic message when auth throws non-Error', async () => {
    signInEmail().mockRejectedValueOnce('boom');
    const result = await signInAction({ email: 'a@b.com', password: 'pass' });
    expect(result).toEqual({ ok: false, error: 'Sign in failed' });
  });
});

describe('signUpAction', () => {
  it('fails invalid schema with first issue message', async () => {
    const result = await signUpAction({ name: '', email: 'x' } as never);
    expect(result).toEqual({ ok: false, error: 'Name is required' });
    expect(signUpEmail()).not.toHaveBeenCalled();
  });

  it('creates user, promotes role, inserts profile when businessName present', async () => {
    signUpEmail().mockResolvedValueOnce({ user: { id: 'u1' } } as never);

    const result = await signUpAction({
      name: 'John',
      email: 'j@b.com',
      password: '12345678',
      businessName: 'Acme',
    });

    expect(result).toEqual({ ok: true, data: { role: 'MERCHANT' } });
    expect(dbMocks.update).toHaveBeenCalled();
    expect(dbMocks.insert).toHaveBeenCalled();
  });

  it('skips merchantProfile insert when businessName omitted', async () => {
    signUpEmail().mockResolvedValueOnce({ user: { id: 'u2' } } as never);

    const result = await signUpAction({
      name: 'John',
      email: 'j@b.com',
      password: '12345678',
    });

    expect(result).toEqual({ ok: true, data: { role: 'MERCHANT' } });
    expect(dbMocks.update).toHaveBeenCalled();
    expect(dbMocks.insert).not.toHaveBeenCalled();
  });

  it('fails when created user is falsy', async () => {
    signUpEmail().mockResolvedValueOnce({ user: null } as never);
    const result = await signUpAction({
      name: 'John',
      email: 'j@b.com',
      password: '12345678',
    });
    expect(result).toEqual({ ok: false, error: 'Registration failed' });
  });

  it('fails with generic message when auth throws non-Error', async () => {
    signUpEmail().mockRejectedValueOnce('boom');
    const result = await signUpAction({
      name: 'John',
      email: 'j@b.com',
      password: '12345678',
    });
    expect(result).toEqual({ ok: false, error: 'Registration failed' });
  });

  it('fails with thrown error message', async () => {
    signUpEmail().mockRejectedValueOnce(new Error('email taken'));
    const result = await signUpAction({
      name: 'John',
      email: 'j@b.com',
      password: '12345678',
    });
    expect(result).toEqual({ ok: false, error: 'email taken' });
  });
});

describe('signOutAction', () => {
  it('returns ok(undefined) on success', async () => {
    signOut().mockResolvedValueOnce({} as never);
    const result = await signOutAction();
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('fails when auth throws', async () => {
    signOut().mockRejectedValueOnce(new Error('nope'));
    const result = await signOutAction();
    expect(result).toEqual({ ok: false, error: 'Sign out failed' });
  });
});
