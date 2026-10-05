import type { Metadata, MetadataRoute } from "next";

// Only login and admin pages advertise this app. Tenant pages keep their own manifest.
export const adminAppMetadata: Metadata = {
  applicationName: "Yardle Admin",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Yardle Admin", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/admin-icons/icon-192.png", type: "image/png", sizes: "192x192" }],
    apple: [{ url: "/admin-icons/icon-180.png", type: "image/png", sizes: "180x180" }]
  }
};



export function adminManifest(): MetadataRoute.Manifest {
  return {
    id: "/admin",
    name: "Yardle Admin",
    short_name: "Yardle Admin",
    description: "Yardle estate and rent administration",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    background_color: "#121416",
    theme_color: "#121416",
    prefer_related_applications: false,
    icons: [
      {src:"/admin-icons/icon-192.png",sizes:"192x192",type:"image/png",purpose:"any"},
      {src:"/admin-icons/icon-512.png",sizes:"512x512",type:"image/png",purpose:"any"},
      {src:"/admin-icons/icon-512.png",sizes:"512x512",type:"image/png",purpose:"maskable"}
    ]
  };
}
