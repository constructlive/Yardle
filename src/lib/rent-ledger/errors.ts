export class RentError extends Error { readonly name = "RentError"; }
export class RentFieldError extends RentError {
  constructor(readonly field: string, message: string) { super(message); }
}
export type ActionResult<T> = { ok: true; value: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };
