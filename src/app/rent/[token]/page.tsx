import { redirect } from "next/navigation";
export const dynamic="force-dynamic";
export default async function RentPortal({params,searchParams}:{params:{token:string};searchParams:{month?:string}}) {
  redirect(`/account/${encodeURIComponent(params.token)}?tab=rent${searchParams.month ? `&month=${encodeURIComponent(searchParams.month)}` : ""}`);
}
