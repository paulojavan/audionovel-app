import { getRecentSecurityEvents } from "@/lib/device-session";

export default async function AdminSecurityPage() {
  const events = await getRecentSecurityEvents(80);

  return (
    <div className="grid gap-5">
      <section>
        <p className="text-sm font-bold uppercase text-[#18b7bd]">Controle de dispositivos</p>
        <h2 className="mt-1 text-3xl font-black">Alertas de seguranca</h2>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Tentativas de terceiro dispositivo e mudancas suspeitas de dispositivo encerram as sessoes do usuario e aparecem aqui.
        </p>
      </section>

      <section className="overflow-hidden rounded-lg border border-white/10 bg-[#06272b]">
        {events.length ? (
          events.map((event) => (
            <article key={event.id} className="grid gap-2 border-b border-white/10 p-4 last:border-b-0 md:grid-cols-[1fr_auto]">
              <div>
                <p className="font-black">{event.message}</p>
                <p className="mt-1 text-sm text-zinc-400">
                  {event.userName ?? "Usuario"} - {event.userEmail ?? event.userId}
                </p>
                <p className="mt-1 text-xs font-bold uppercase text-[#8ff7ff]">{event.type}</p>
              </div>
              <time className="text-sm text-zinc-400">{new Date(event.createdAt).toLocaleString("pt-BR")}</time>
            </article>
          ))
        ) : (
          <p className="p-4 text-zinc-400">Nenhum alerta de seguranca registrado.</p>
        )}
      </section>
    </div>
  );
}
