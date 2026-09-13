/** Result envelope for server actions so the client can toast + redirect. */
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(message: string): ActionResult<never> {
  return { ok: false, error: message };
}
