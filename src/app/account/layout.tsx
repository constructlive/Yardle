import "./portal.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PrivatePageLifecycle } from "@/components/tenant-portal/private-page";
export const metadata:Metadata={applicationName:"Yardle Tenant",appleWebApp:{capable:true,title:"Yardle",statusBarStyle:"black-translucent"},icons:{apple:"/portal-icon/192",icon:"/portal-icon/192"},robots:{index:false,follow:false},referrer:"no-referrer"};
export const viewport:Viewport={width:"device-width",initialScale:1,themeColor:"#121416"};
export default function Layout({children}:{children:ReactNode}){return <><PrivatePageLifecycle/>{children}</>;}
