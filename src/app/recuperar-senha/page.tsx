import Image from "next/image";
import Link from "next/link";
import { PasswordResetRequestForm } from "@/components/password-reset-request-form";

export default function PasswordResetRequestPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <Image src="/logo-audio-novel-br.png" alt="Audio Novel BR" width={64} height={64} className="h-16 w-16 rounded-md object-cover ring-1 ring-[#18b7bd]/40" />
        <span className="text-2xl font-black">Audio Novel BR</span>
      </Link>
      <h1 className="text-4xl font-black">Recuperar senha</h1>
      <p className="mt-2 text-zinc-300">
        Informe o e-mail cadastrado para receber um link temporario de redefinicao.
      </p>
      <PasswordResetRequestForm />
      <p className="mt-5 text-sm text-zinc-400">
        Lembrou a senha?{" "}
        <Link href="/login" className="font-bold text-[#8ff7ff] hover:text-white">
          Voltar para login
        </Link>
      </p>
    </div>
  );
}
