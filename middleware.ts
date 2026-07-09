import { NextResponse, type NextRequest } from "next/server";
const sessionCookie = "yardle_admin_session";
function decodeBase64Url(value: string) { const base64=value.replace(/-/g,"+").replace(/_/g,"/"); return Uint8Array.from(atob(base64),(character)=>character.charCodeAt(0)); }
async function validAdminSession(value?: string) {
  if (!value) return false; const [payload,signature]=value.split("."); const secret=process.env.AUTH_SECRET||process.env.ADMIN_PASSWORD; if(!payload||!signature||!secret)return false;
  try { const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]); const valid=await crypto.subtle.verify("HMAC",key,decodeBase64Url(signature),new TextEncoder().encode(payload)); if(!valid)return false; const session=JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as {exp?:number}; return typeof session.exp==="number"&&session.exp>Date.now(); } catch { return false; }
}
export async function middleware(request: NextRequest) { if(await validAdminSession(request.cookies.get(sessionCookie)?.value))return NextResponse.next(); const loginUrl=new URL("/login",request.url); loginUrl.searchParams.set("next",`${request.nextUrl.pathname}${request.nextUrl.search}`); return NextResponse.redirect(loginUrl); }
export const config={matcher:["/admin/:path*"]};