import Image from "next/image";

export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center overflow-hidden rounded-2xl border border-slateLine bg-[#121416] p-2 shadow-soft ${className}`}>
      <Image src="/yardle.png" alt="Yardle" width={640} height={200} className="h-full w-full object-contain" priority />
    </span>
  );
}
