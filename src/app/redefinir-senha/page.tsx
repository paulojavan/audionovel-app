import Image from "next/image";
import Link from "next/link";
import { PasswordResetConfirmForm } from "@/components/password-reset-confirm-form";

export default async function PasswordResetConfirmPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <Image src="/logo-audio-novel-br.png" alt="Audio Novel BR" width={64} height={64} className="h-16 w-16 rounded-md object-cover ring-1 ring-[#18b7bd]/40" />
        <span className="text-2xl font-black">Audio Novel BR</span>
      </Link>
      <h1 className="text-4xl font-black">Redefinir senha</h1>
      <p className="mt-2 text-zinc-300">
        Crie uma nova senha. Depois disso, as sessoes abertas desta conta serao encerradas.
      </p>
      <PasswordResetConfirmForm token={token ?? ""} />
    </div>
  );
}
