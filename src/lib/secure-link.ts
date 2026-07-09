import { randomBytes } from "node:crypto";

export function createTenantAccessToken() {
  return randomBytes(32).toString("base64url");
}

export function getAppBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function getTenantBillPath(token: string) {
  return `/bill/${token}`;
}

export function getTenantBillUrl(token: string) {
  return `${getAppBaseUrl()}${getTenantBillPath(token)}`;
}
