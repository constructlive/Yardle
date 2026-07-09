export interface TenantMeta {
  notes: string;
  billingAddress: string;
  portalLoginEmail: string;
  portalEnabled: boolean;
}

const prefix = "yardle_meta:";

export function parseTenantMeta(notes?: string | null): TenantMeta {
  const empty = { notes: notes ?? "", billingAddress: "", portalLoginEmail: "", portalEnabled: false };
  if (!notes?.startsWith(prefix)) {
    return empty;
  }
  try {
    const parsed = JSON.parse(notes.slice(prefix.length)) as Partial<TenantMeta>;
    return {
      notes: parsed.notes ?? "",
      billingAddress: parsed.billingAddress ?? "",
      portalLoginEmail: parsed.portalLoginEmail ?? "",
      portalEnabled: Boolean(parsed.portalEnabled)
    };
  } catch {
    return { notes, billingAddress: "", portalLoginEmail: "", portalEnabled: false };
  }
}

export function serializeTenantMeta(meta: TenantMeta): string {
  return `${prefix}${JSON.stringify(meta)}`;
}

