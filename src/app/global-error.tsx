"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#020b0d",
          color: "#e4e4e7",
          fontFamily: "system-ui, sans-serif",
          padding: "1.5rem",
        }}
      >
        <main style={{ maxWidth: "26rem", textAlign: "center" }}>
          <p style={{ color: "#18b7bd", fontWeight: 800, textTransform: "uppercase", fontSize: "0.875rem" }}>
            Audio Novel BR
          </p>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 900, margin: "0.5rem 0" }}>
            Nao foi possivel carregar o aplicativo
          </h1>
          <p style={{ color: "#a1a1aa", lineHeight: 1.6 }}>
            Ocorreu uma falha inesperada. Tente novamente para voltar a ouvir suas novels.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              marginTop: "1.25rem",
              background: "#18b7bd",
              color: "#021114",
              border: "none",
              borderRadius: 9999,
              padding: "0.75rem 1.5rem",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
