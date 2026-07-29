import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";
import { getActiveServerSession } from "@/lib/safe-auth-session";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Entre na sua conta do Áudio Novel BR e continue suas histórias.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ blocked?: string; signup?: string; callbackUrl?: string }>;
}) {
  const { blocked, signup, callbackUrl } = await searchParams;
  const session = await getActiveServerSession();
  if (session) {
    const safeCallbackUrl =
      callbackUrl?.startsWith("/") &&
      !callbackUrl.startsWith("//") &&
      !callbackUrl.startsWith("/login")
        ? callbackUrl
        : "/";
    redirect(safeCallbackUrl);
  }

  const initialError =
    blocked === "1"
      ? "Usuário bloqueado. Entre em contato com o administrador via Discord."
      : signup === "disabled"
        ? "Novos cadastros estão temporariamente desativados."
        : "";

  return (
    <AuthShell
      eyebrow="Bem-vindo de volta"
      title="Entre na sua conta"
      description="Acesse sua biblioteca e continue ouvindo exatamente de onde parou."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="font-black text-[#70e8ed] transition hover:text-white">
            Criar conta
          </Link>
        </>
      }
    >
      <LoginForm initialError={initialError} callbackUrl={callbackUrl ?? "/"} />
    </AuthShell>
  );
}
