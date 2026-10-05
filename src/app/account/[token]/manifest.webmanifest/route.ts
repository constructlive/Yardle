import { getTenantPortal } from "@/lib/tenant-portal/access";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:{token:string}}) {
  if(!await getTenantPortal(params.token))return new Response("Unavailable",{status:404,headers:{"Cache-Control":"private, no-store"}});
  return Response.json({id:`/account/${params.token}`,name:"Yardle Tenant",short_name:"Yardle",start_url:`/account/${params.token}`,scope:"/account/",display:"standalone",background_color:"#121416",theme_color:"#121416",icons:[{src:"/portal-icon/192",sizes:"192x192",type:"image/png"},{src:"/portal-icon/512",sizes:"512x512",type:"image/png",purpose:"any maskable"}]},{headers:{"Content-Type":"application/manifest+json","Cache-Control":"private, no-store"}});
}
