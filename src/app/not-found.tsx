import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-[70vh] place-items-center px-4 py-16 text-center">
      <div className="max-w-lg">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-[#22d3dc]">Erro 404</p>
        <h1 className="mt-3 text-4xl font-black">Esta pagina nao foi encontrada</h1>
        <p className="mt-3 text-zinc-400">O conteudo pode ter sido removido, renomeado ou ainda nao estar publicado.</p>
        <Link href="/novels" className="mt-6 inline-flex rounded-full bg-[#18b7bd] px-5 py-3 font-black text-[#021114]">
          Explorar novels
        </Link>
      </div>
    </main>
  );
}
