export class RentError extends Error { readonly name = "RentError"; }
export type ActionResult<T> = { ok: true; value: T } | { ok: false; error: string };
