import { describe, expect, it } from "vitest";
import { accountPath, findRouteAccount } from "./links";

describe("rent account routes", () => {
  it.each(["unit:c3a2a9a0-fda8-4a83-a126-987eeb3af253", "notes:yard / storage", "notes:José & sons 50%", "ordinary-uuid"])("round-trips %s without escaped path characters", id => {
    const account = { id };
    const key = accountPath(id).split("/").at(-1)!;
    expect(key).toMatch(/^account-[a-f0-9]+$/);
    expect(findRouteAccount([account], key)).toBe(account);
  });
  it("supports decoded and encoded old links without changing literal IDs", () => {
    const accounts = [{ id: "unit:123" }, { id: "unit%3A123" }];
    expect(findRouteAccount(accounts, "unit:123")).toBe(accounts[0]);
    expect(findRouteAccount(accounts, "unit%3A123")).toBe(accounts[1]);
    expect(findRouteAccount(accounts.slice(0, 1), "unit%3A123")).toBe(accounts[0]);
  });
  it("rejects invalid and missing keys", () => {
    expect(findRouteAccount([], "account-ff")).toBeUndefined();
    expect(findRouteAccount([], "%bad%")).toBeUndefined();
    expect(findRouteAccount([{ id: "unit:123" }], "unknown")).toBeUndefined();
  });
});
