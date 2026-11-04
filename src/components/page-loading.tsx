export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-16 text-sm text-slate-500" role="status">
      {label}
    </div>
  );
}
