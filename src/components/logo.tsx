import { MapPinned } from "lucide-react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-slate-950">
        <MapPinned size={18} />
      </span>
      <span className="text-lg font-semibold tracking-tight text-white">
        OnGoing <span className="text-emerald-400">Virtual Venue</span>
      </span>
    </div>
  );
}
