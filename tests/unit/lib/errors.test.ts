import { describe, expect, it, vi } from 'vitest';

import { AppError, ForbiddenError, toErrorResponse, UnauthorizedError } from '@/lib/errors';

describe('lib/errors', () => {
  describe('AppError', () => {
    it('sets status, code, and message', () => {
      const err = new AppError(418, 'TEAPOT', 'I am a teapot');
      expect(err.status).toBe(418);
      expect(err.code).toBe('TEAPOT');
      expect(err.message).toBe('I am a teapot');
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('UnauthorizedError', () => {
    it('defaults to 401 / UNAUTHORIZED / Authentication required', () => {
      const err = new UnauthorizedError();
      expect(err.status).toBe(401);
      expect(err.code).toBe('UNAUTHORIZED');
      expect(err.message).toBe('Authentication required');
    });

    it('accepts a custom message', () => {
      const err = new UnauthorizedError('nope');
      expect(err.message).toBe('nope');
    });
  });

  describe('ForbiddenError', () => {
    it('defaults to 403 / FORBIDDEN / Insufficient permissions', () => {
      const err = new ForbiddenError();
      expect(err.status).toBe(403);
      expect(err.code).toBe('FORBIDDEN');
      expect(err.message).toBe('Insufficient permissions');
    });

    it('accepts custom code and message', () => {
      const err = new ForbiddenError('NO_ROLE', 'Wrong role');
      expect(err.code).toBe('NO_ROLE');
      expect(err.message).toBe('Wrong role');
    });
  });

  describe('toErrorResponse', () => {
    it('returns JSON Response with AppError status and body', () => {
      const res = toErrorResponse(new AppError(422, 'VALIDATION', 'Bad input'));
      expect(res).toBeInstanceOf(Response);
      expect(res.status).toBe(422);
      // consume body
      return res.json().then((body) => {
        expect(body).toEqual({ error: { code: 'VALIDATION', message: 'Bad input' } });
      });
    });

    it('returns 500 for unknown errors', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const res = toErrorResponse('something broke');
      expect(res.status).toBe(500);
      return res.json().then((body) => {
        expect(body).toEqual({ error: { code: 'INTERNAL', message: 'Unexpected error' } });
      });
    });
  });
});
