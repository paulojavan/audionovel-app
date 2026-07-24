"use client";

import { useEffect } from "react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg bg-[#06272b] p-6 text-center">
        <p className="text-sm font-bold uppercase text-[#18b7bd]">Algo deu errado</p>
        <h1 className="mt-2 text-2xl font-black">Nao foi possivel carregar esta pagina</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Sua conexao ou o servidor oscilou por um instante. Tente novamente para continuar de onde parou.
        </p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="mt-5 inline-flex rounded-full bg-[#18b7bd] px-5 py-3 font-black text-[#021114] hover:bg-[#22d3dc]"
        >
          Tentar novamente
        </button>
      </section>
    </div>
  );
}
