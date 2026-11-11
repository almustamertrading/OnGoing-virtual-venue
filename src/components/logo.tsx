import Image from "next/image";

export function Logo({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Image src="/brand/wordmark-dark.svg" alt="Ongoing Events" width={515} height={96} priority className={`${compact ? "h-6" : "h-8"} w-auto`} />
      <span className={`${compact ? "hidden md:inline" : ""} border-l border-slate-700 pl-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400`}>Platform</span>
    </div>
  );
}
