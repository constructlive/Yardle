/** Hex route keys avoid proxies decoding punctuation in legacy account IDs. */
export function accountPath(id: string) {
  const key = Array.from(new TextEncoder().encode(id), byte => byte.toString(16).padStart(2, "0")).join("");
  return `/admin/rent/accounts/account-${key}`;
}

export function findRouteAccount<T extends { id: string }>(accounts: T[], key: string): T | undefined {
  // Prefer literal IDs to preserve existing links, including IDs containing percent signs.
  const exact = accounts.find(account => account.id === key);
  if (exact) return exact;
  if (/^account-(?:[a-f0-9]{2})+$/.test(key)) {
    const bytes = key.slice(8).match(/../g)!.map(pair => parseInt(pair, 16));
    try {
      const id = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
      return accounts.find(account => account.id === id);
    } catch { return undefined; }
  }
  try {
    const id = decodeURIComponent(key);
    return accounts.find(account => account.id === id);
  } catch { return undefined; }
}
