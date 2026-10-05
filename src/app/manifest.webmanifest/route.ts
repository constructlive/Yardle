import { adminManifest } from "../../lib/admin-pwa";

export const dynamic = "force-static";
export function GET() {
  return Response.json(adminManifest(), {headers:{"Content-Type":"application/manifest+json","Cache-Control":"public, max-age=0, must-revalidate"}});
}
