import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/components/register-form";
import { getSystemSettingBoolean, SYSTEM_SETTING_KEYS } from "@/lib/system-settings";

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Crie sua conta no Áudio Novel BR e descubra histórias para ler e ouvir.",
};

export default async function RegisterPage() {
  const registrationsEnabled = await getSystemSettingBoolean(SYSTEM_SETTING_KEYS.registrationsEnabled, true);

  return (
    <AuthShell
      eyebrow="Comece sua jornada"
      title="Crie sua conta"
      description={
        registrationsEnabled
          ? "Monte sua biblioteca, salve o progresso e leve suas histórias favoritas com você."
          : "Os novos cadastros estão pausados neste momento."
      }
      footer={
        <>
          Já tem uma conta?{" "}
          <Link href="/login" className="font-black text-[#70e8ed] transition hover:text-white">
            Entrar
          </Link>
        </>
      }
    >
      {registrationsEnabled ? (
        <RegisterForm />
      ) : (
        <div className="mt-7 rounded-2xl border border-amber-300/20 bg-amber-300/8 p-4 text-sm leading-6 text-amber-100">
          Novos cadastros estão temporariamente desativados. Quem já possui conta ainda pode entrar normalmente.
        </div>
      )}
    </AuthShell>
  );
}
