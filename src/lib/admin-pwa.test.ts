import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { adminAppMetadata, adminManifest } from "./admin-pwa";
import { GET as manifestResponse } from "../app/manifest.webmanifest/route";
vi.mock("@/lib/tenant-portal/access",()=>({getTenantPortal:async(token:string)=>token==="valid-private-token"?{}:undefined}));
import { GET as tenantManifestResponse } from "../app/account/[token]/manifest.webmanifest/route";

describe("separate admin PWA installation",()=>{
  it("provides a public standalone manifest and real PNG icons at the declared sizes",async()=>{
    const response=manifestResponse(),manifest=await response.json();
    expect(response.status).toBe(200);expect(response.headers.get("Content-Type")).toBe("application/manifest+json");
    expect(manifest).toMatchObject({id:"/admin",name:"Yardle Admin",start_url:"/admin",scope:"/",display:"standalone",prefer_related_applications:false});
    expect(adminAppMetadata.manifest).toBe("/manifest.webmanifest");
    for(const size of [192,512]){
      const icon=adminManifest().icons!.find(i=>i.sizes===`${size}x${size}`&&i.purpose==="any")!;
      const png=readFileSync(`public${icon.src}`);
      expect(png.subarray(0,8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(png.readUInt32BE(16)).toBe(size);expect(png.readUInt32BE(20)).toBe(size);
    }
  });
  it("keeps tenant identity and private launch link separate and rejects invalid links",async()=>{
    const response=await tenantManifestResponse(new Request("https://example.test"),{params:{token:"valid-private-token"}});
    expect(await response.json()).toMatchObject({id:"/account/valid-private-token",start_url:"/account/valid-private-token",scope:"/account/",name:"Yardle Tenant"});
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect((await tenantManifestResponse(new Request("https://example.test"),{params:{token:"invalid"}})).status).toBe(404);
  });
});
