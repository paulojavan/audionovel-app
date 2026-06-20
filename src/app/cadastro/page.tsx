import Image from "next/image";
import Link from "next/link";
import { RegisterForm } from "@/components/register-form";
import { getSystemSettingBoolean, SYSTEM_SETTING_KEYS } from "@/lib/system-settings";

export default async function RegisterPage() {
  const registrationsEnabled = await getSystemSettingBoolean(SYSTEM_SETTING_KEYS.registrationsEnabled, true);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <Image src="/logo-audio-novel-br.png" alt="Áudio Novel BR" width={64} height={64} className="h-16 w-16 rounded-md object-cover ring-1 ring-[#18b7bd]/40" />
        <span className="text-2xl font-black">Áudio Novel BR</span>
      </Link>
      <h1 className="text-4xl font-black">Criar conta</h1>
      {registrationsEnabled ? (
        <>
          <p className="mt-2 text-zinc-300">
            Crie sua conta com e-mail e senha.
          </p>
          <RegisterForm />
          <p className="mt-5 text-sm text-zinc-400">
            Ja tem conta?{" "}
            <Link href="/login" className="font-bold text-[#8ff7ff] hover:text-white">
              Entrar
            </Link>
          </p>
        </>
      ) : (
        <div className="mt-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-100">
          Novos cadastros estao temporariamente desativados. Quem ja possui conta ainda pode entrar normalmente pela pagina de login.
        </div>
      )}
    </div>
  );
}
