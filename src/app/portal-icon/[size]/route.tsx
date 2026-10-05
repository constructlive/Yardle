import { ImageResponse } from "next/og";
export const runtime="edge";
export async function GET(_request:Request,{params}:{params:{size:string}}) {
  if(!["192","512"].includes(params.size))return new Response("Not found",{status:404});
  const size=Number(params.size);
  return new ImageResponse(<div style={{display:"flex",alignItems:"center",justifyContent:"center",width:"100%",height:"100%",background:"#121416",color:"#fbbf24",fontSize:size*0.55,fontWeight:900}}>Y</div>,{width:size,height:size});
}
