export default function Loading() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4 py-10" role="status" aria-label="Carregando">
      <div className="flex flex-col items-center gap-3">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-[#18b7bd]/30 border-t-[#18b7bd]" />
        <p className="text-sm font-bold text-zinc-400">Carregando...</p>
      </div>
    </div>
  );
}
