import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ blocked?: string; signup?: string; callbackUrl?: string }> }) {
  const { blocked, signup, callbackUrl } = await searchParams;
  const initialError =
    blocked === "1"
      ? "Usuario bloqueado. Entre em contato com o administrador via Discord."
      : signup === "disabled"
        ? "Novos cadastros estao temporariamente desativados."
        : "";

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <Image src="/logo-audio-novel-br.png" alt="Áudio Novel BR" width={64} height={64} className="h-16 w-16 rounded-md object-cover ring-1 ring-[#18b7bd]/40" />
        <span className="text-2xl font-black">Áudio Novel BR</span>
      </Link>
      <h1 className="text-4xl font-black">Entrar</h1>
      <p className="mt-2 text-zinc-300">
        Acesse sua conta usando e-mail e senha.
      </p>
      <LoginForm initialError={initialError} callbackUrl={callbackUrl ?? "/"} />
      <p className="mt-5 text-sm text-zinc-400">
        Ainda nao tem conta?{" "}
        <Link href="/cadastro" className="font-bold text-[#8ff7ff] hover:text-white">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
