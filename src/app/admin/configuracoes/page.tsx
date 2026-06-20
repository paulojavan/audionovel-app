import { AdminSystemSettingsForm } from "@/components/admin-system-settings-form";
import { getSystemSettings } from "@/lib/system-settings";

export default async function AdminSettingsPage() {
  const settings = await getSystemSettings();

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="text-2xl font-bold">Configuracoes do sistema</h2>
        <p className="mt-1 text-sm text-zinc-400">Controle rapidamente recursos sensiveis da plataforma.</p>
      </div>
      <AdminSystemSettingsForm initialSettings={settings} />
    </section>
  );
}
