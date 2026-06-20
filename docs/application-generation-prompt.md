# Prompt Completo Para Gerar a Aplicacao Audio Novel BR

Use o prompt abaixo para pedir a uma IA/agente de codigo que gere uma aplicacao equivalente do zero.

---

Voce e um engenheiro full-stack senior. Crie uma aplicacao web chamada **Audio Novel BR**, uma plataforma dark theme para ouvir novels em audio com texto sincronizado, experiencia semelhante a Spotify, assinatura premium, offline protegido e painel administrativo completo.

## Objetivo

Construir uma plataforma onde usuarios possam:

- Entrar com Google.
- Descobrir novels.
- Ouvir capitulos em audio.
- Assistir capitulos do YouTube quando o capitulo for video.
- Acompanhar texto sincronizado ao audio.
- Usar modo karaoke.
- Continuar de onde pararam.
- Favoritar novels.
- Avaliar novels por estrelas.
- Comentar em novels e capitulos.
- Responder comentarios.
- Receber notificacoes quando respostas forem aprovadas.
- Contratar premium.
- Salvar capitulos offline de forma criptografada.

Administradores devem conseguir:

- Gerenciar novels, tags, volumes e capitulos.
- Criar capitulos individuais e em lote.
- Editar novels e capitulos.
- Gerenciar usuarios.
- Ver estatisticas de usuario.
- Bloquear/desbloquear usuarios.
- Conceder premium manualmente.
- Configurar planos.
- Configurar pagamentos Stripe por cartao e Pix.
- Moderar comentarios.
- Ver financeiro.
- Ativar/desativar cadastros.
- Ativar/desativar compras.

## Restricoes

- Nao use Docker.
- Use tema dark.
- Use design responsivo desktop/mobile.
- Nao exponha chaves, segredos ou URLs privadas.
- Nao use login por email/senha; use Google OAuth.
- Inclua um login de desenvolvimento opcional, ativado por env, que nunca funcione em producao.
- Audio offline deve ser criptografado no navegador.
- Audio offline nao deve ficar como arquivo comum baixado no dispositivo.
- YouTube nao deve ter offline.
- Use salvamento de progresso otimizado: salvar ao iniciar, pausar e finalizar, nao a cada segundo.

## Stack Recomendada

- Next.js App Router.
- React.
- TypeScript.
- Tailwind CSS.
- Prisma ORM.
- SQLite para desenvolvimento.
- NextAuth com Google OAuth.
- Stripe Checkout e Webhooks.
- Zod para validacao.
- lucide-react para icones.
- IndexedDB + Web Crypto API para cache local criptografado.
- Service Worker para carregar pagina offline.

## Identidade Visual

- Nome: Audio Novel BR.
- Tema dark com turquesa/ciano como cor principal.
- Fundo preto/verde muito escuro.
- Paineis azul-petroleo escuro.
- Botoes primarios turquesa com texto escuro.
- Botoes secundarios escuros com borda clara.
- Evitar baixo contraste.
- Layout inspirado em apps de streaming.

## Modelagem de Dados

Crie modelos equivalentes a:

### User

Campos:

- id.
- name.
- email unico.
- passwordHash placeholder para compatibilidade.
- role: USER ou ADMIN.
- plan: FREE ou PREMIUM.
- subscriptionStatus.
- stripeCustomerId.
- stripeSubscriptionId.
- premiumUntil.
- isBlocked.
- blockedReason.
- blockedAt.
- adminNotes.
- createdAt.
- updatedAt.

Relacionamentos:

- comments.
- notifications.
- favorites.
- listeningProgress.
- novelReactions.
- chapterReactions.
- payments.
- manualSubscriptionLogs.
- offlineDownloads.

### Novel

Campos:

- id.
- slug unico.
- title.
- author.
- narrator opcional.
- synopsis.
- coverUrl.
- status.
- viewCount.
- likeCount/dislikeCount legado se desejar.
- ratingScore.
- ratingCount.
- createdAt.
- updatedAt.

Relacionamentos:

- volumes.
- comments.
- favorites.
- reactions.
- tags.

### Tag e NovelTag

- Tag com name e slug unicos.
- Tabela de join NovelTag.

### Volume

- id.
- title.
- position.
- novelId.
- unique novelId + position.
- chapters.

### Chapter

Campos:

- id.
- title.
- position.
- contentType: AUDIO ou YOUTUBE.
- durationSec.
- audioUrl.
- youtubeUrl.
- youtubeVideoId.
- coverUrl opcional.
- startSec.
- transcriptJson.
- premiumOnly.
- published.
- viewCount.
- likeCount.
- dislikeCount.
- volumeId.
- createdAt.
- updatedAt.

Relacionamentos:

- comments.
- progress.
- reactions.
- offlineDownloads.

### ListeningProgress

- userId.
- chapterId.
- positionSec.
- durationSec.
- completed.
- updatedAt.
- unique userId + chapterId.

### Favorite

- userId.
- novelId.
- unique userId + novelId.

### NovelReaction

- userId.
- novelId.
- rating de 1 a 5.
- unique userId + novelId.

### ChapterReaction

- userId.
- chapterId.
- type LIKE ou DISLIKE.
- unique userId + chapterId.

### Comment

- body.
- status: PENDING, APPROVED, REMOVED.
- userId.
- novelId opcional.
- chapterId opcional.
- parentId opcional.
- editedAt.
- approvedAt.
- removedAt.
- moderatedByAdminId.
- timestamps.

### Notification

- userId.
- commentId opcional.
- type.
- title.
- message.
- href.
- readAt.
- createdAt.

### PaymentTransaction

- userId opcional.
- stripeEventId unico.
- stripePaymentId.
- amountCents.
- currency.
- status.
- description.
- createdAt.

### SubscriptionPlan

- slug.
- name.
- description.
- amountCents.
- currency.
- interval.
- active.
- allowCard.
- allowPix.
- stripePriceId.
- sortOrder.

### ManualSubscription

- userId.
- adminUserId.
- plan.
- premiumUntil.
- reason.
- createdAt.

### OfflineDownload

- userId.
- chapterId.
- cacheKey unico.
- expiresAt.
- lastUsedAt.
- createdAt.
- unique userId + chapterId.

### SystemSetting

- key.
- value.
- timestamps.

## Autenticacao

Implemente NextAuth com GoogleProvider.

Variaveis:

- NEXTAUTH_URL.
- NEXTAUTH_SECRET.
- GOOGLE_CLIENT_ID.
- GOOGLE_CLIENT_SECRET.
- GOOGLE_ADMIN_EMAILS.

Regras:

- Ao login Google, criar usuario se nao existir.
- Se email estiver em GOOGLE_ADMIN_EMAILS, criar como ADMIN.
- Se usuario estiver bloqueado, negar acesso.
- Se cadastro estiver desativado, impedir novo usuario nao-admin.
- Manter sessao JWT com id, role, plan, subscriptionStatus, premiumUntil e isBlocked.

Login dev:

- Provider credentials com id `dev-login`.
- Ativar somente quando NODE_ENV nao for production e DEV_AUTH_BYPASS=true.
- Usar DEV_AUTH_EMAIL ou fallback `teste@audio-novel-br.local`.
- Criar usuario teste como USER.

## Controle de Acesso

Crie proxy/middleware:

- Rotas publicas: `/`, `/login`, `/cadastro`, `/api/auth`.
- Rotas internas exigem sessao.
- Admin exige role ADMIN.
- Usuario bloqueado e redirecionado para login.

## Layout

### Nao logado

Exibir apenas landing page, login e cadastro.

### Logado desktop

Exibir sidebar:

- Inicio.
- Novels.
- Biblioteca.
- Offline.
- Notificacoes.
- Assinaturas apenas se usuario nao for premium.
- Admin apenas para admin.
- Perfil.

### Logado mobile

Exibir menu inferior fixo:

- Inicio.
- Novels.
- Biblioteca.
- Offline.
- Avisos.
- Planos quando aplicavel.
- Admin quando aplicavel.

Garantir botoes com area de toque minima de 44px.

## Landing Page

Criar hero com:

- Logo.
- Nome Audio Novel BR.
- Chamada para ouvir novels.
- Botoes Entrar e Criar conta.
- Destaques:
  - Player imersivo.
  - Offline protegido.
  - Premium seguro.
- Cards de valor:
  - Biblioteca organizada.
  - Avaliacoes por estrelas.
  - Audio + texto.

## Home Autenticada

Mostrar:

- Hero interno.
- Recomendacoes baseadas em novels avaliadas com nota alta.
- Ranking alternavel dinamicamente entre mais vistas e melhor avaliadas.
- Cards de novels.

## Catalogo de Novels

Criar pagina `/novels` com:

- Busca por titulo, autor e sinopse.
- Filtro por tags.
- Filtro por autor.
- Paginacao.
- Cards com capa, titulo, autor clicavel, media de estrelas e tags.

## Pagina da Novel

Mostrar:

- Capa.
- Titulo.
- Sinopse.
- Autor clicavel.
- Visualizacoes.
- Tags clicaveis.
- Nota por estrelas.
- Botao favoritar.
- Volumes em acordeons.
- Capitulos por volume.
- Comentarios.

Desktop:

- Tabela de capitulos.

Mobile:

- Cards de capitulos.

Cada capitulo:

- Link para abrir.
- Tipo audio ou YouTube.
- Duracao ou YouTube.
- Visualizacoes.
- Free/Premium.
- Estado ouvido.
- Botao de offline, apenas quando possivel.

## Player de Capitulo

Para AUDIO:

- Audio element controlado por React.
- Botao play/pause.
- Barra de progresso.
- Tempo atual e duracao.
- Botao retroceder 10s.
- Botao avancar 10s.
- Seletor de modo:
  - Karaoke.
  - Pagina.
- Texto/transcript abaixo.
- Comentarios abaixo.

Regras importantes:

- Chamar `audio.play()` diretamente em resposta ao clique do usuario.
- Salvar progresso em segundo plano.
- Salvar progresso ao iniciar, pausar e finalizar.
- Mostrar erro claro se o audio nao iniciar.

Modo pagina:

- Ao tocar, permanece na pagina.
- Exibe volume e velocidade.

Modo karaoke:

- Fullscreen.
- Fundo preto com capa em opacidade baixa.
- Frase atual no centro.
- Frase anterior e proxima com opacidade menor.
- Controles no rodape:
  - Play/pause.
  - -10s.
  - +10s.
  - Progresso.
  - Volume.
  - Velocidade.
  - Aumentar/diminuir fonte.
- Ao finalizar, sair do karaoke automaticamente.
- Respeitar safe-area mobile.

Para YOUTUBE:

- Exibir iframe `youtube-nocookie`.
- Nao exigir timestamps.
- Ao abrir, contar visualizacao.
- Marcar progresso como visto.
- Nao permitir offline.

## Offline

### Cache temporario

- Ao tocar audio online, cachear no IndexedDB criptografado.
- Expirar em 2 dias.
- Limpar automaticamente.

### Offline premium

- Apenas premium.
- Ao salvar offline:
  - API gera `cacheKey`.
  - Banco registra OfflineDownload com expiresAt de 7 dias.
  - Browser baixa audio via API protegida.
  - Browser criptografa com AES-GCM.
  - Browser salva em IndexedDB.
- Se expirar, remover do IndexedDB e da lista local.

### Pagina `/offline`

- Deve funcionar mesmo sem internet, quando previamente cacheada.
- Lista capitulos offline agrupados por novel.
- Cada novel em dropdown/acordeon.
- Player offline com:
  - Play/pause.
  - -10s.
  - +10s.
  - Progresso.
  - Volume.
  - Velocidade.

## Biblioteca

Criar `/biblioteca` com:

- Ultimos capitulos ouvidos.
- Posicao onde parou ou visto.
- Favoritos.

## Perfil

Criar `/perfil` com:

- Nome.
- Email.
- Plano atual.
- Botao de assinatura se nao for premium.
- Historico financeiro do usuario.

## Notificacoes

Criar `/notificacoes` com:

- Nao lidas.
- Ultimas 20, podendo exceder para incluir nao lidas.
- Marcar todas como lidas.
- Link para destino.

## Comentarios

Criar comentarios em novel e capitulo.

Regras:

- Comentario novo entra como PENDING.
- Resposta tambem entra como PENDING.
- Botao "Responder" sutil abre formulario.
- Usuario pode editar seu comentario.
- Comentario editado volta para PENDING.
- Comentario removido nao pode ser editado.
- Comentario aprovado aparece publicamente.
- Comentario removido aparece publicamente como "Comentario removido pelo administrador".
- Ao aprovar resposta, criar notificacao para dono do comentario pai.
- Rate limit de comentarios.

## Avaliacoes e Reacoes

Novels:

- Sistema de estrelas 1 a 5.
- Usuario pode criar/alterar nota.
- Atualizar media e quantidade.

Capitulos:

- Like/dislike.
- Contadores.

## Assinaturas

Pagina `/assinaturas`:

- Plano Free.
- Planos premium ativos.
- Recursos.
- Preco.
- Metodo: cartao/Pix.
- Botao de contratar.
- Se premium ativo, mostrar Premium ativo.
- Se compras desativadas, bloquear compra.

Stripe:

- Criar Checkout Session.
- Suportar payment_method_types conforme plano.
- Webhook para checkout/session/payment.
- Registrar PaymentTransaction.
- Atualizar usuario para PREMIUM, ACTIVE e premiumUntil.

Fallback local:

- Em desenvolvimento, permitir assinatura de teste se Stripe nao estiver configurado, para validar fluxo.

## Admin

Criar `/admin` protegido por role ADMIN.

### Dashboard

Mostrar:

- Usuarios.
- Premium.
- Novels.
- Capitulos.
- Receita.
- Top novels.
- Pagamentos recentes.
- Link para moderacao.

### Configuracoes

Permitir:

- Ativar/desativar novos cadastros.
- Ativar/desativar compras.

### Novels/Conteudo

Paginas:

- Listagem de novels com busca.
- Botao cadastrar.
- Cadastro de novel com titulo, autor, sinopse, capa, tags.
- Tags existentes clicaveis para associar.
- Botao cadastrar nova tag.
- Edicao de novel.
- Painel da novel com volumes.
- Botao cadastrar volume.
- Botao cadastrar capitulo dentro do volume.
- Cadastro de capitulos individuais e em bloco.
- Edicao de capitulo.

Campos de capitulo:

- Titulo.
- Tipo AUDIO/YOUTUBE.
- URL audio ou URL YouTube.
- Duracao para audio.
- Inicio no audio.
- Transcript JSON para audio.
- Premium only.
- Published.

### Planos

Permitir:

- Criar plano.
- Editar plano.
- Valor.
- Moeda.
- Intervalo.
- Ativo.
- Cartao.
- Pix.
- Stripe Price ID.
- Ordem.

### Usuarios

Listagem com:

- Busca por nome, email, role, plano e status.
- Nome.
- Email.
- Role.
- Plano.
- Status assinatura.
- Bloqueado/ativo.
- Historico resumido.
- Link "Ver estatisticas".

Tela de estatisticas:

- Plano.
- Compras premium.
- Premium manual.
- Total pago.
- Comentarios.
- Novels acompanhadas.
- Historico de mensagens.
- Observacao privada do admin.
- Bloquear/desbloquear.
- Dar premium manual.
- Editar data final de premium.

### Moderacao

Abas:

- Pendentes.
- Removidos.

Acoes:

- Aprovar.
- Remover.
- Comentarios aprovados saem da lista de pendentes.
- Comentarios removidos aparecem na aba removidos.

### Financeiro

Mostrar:

- Receita confirmada.
- Pagamentos aprovados.
- Outros status.
- Lista de transacoes com usuario, descricao, valor, status e data.

## Seguranca

Implemente:

- Variaveis de ambiente para segredos.
- Nunca expor STRIPE_SECRET_KEY, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET.
- Validacao server-side em todas as APIs.
- Role guard para admin.
- Protecao para usuario bloqueado.
- Rate limit para comentarios, audio e offline.
- Validacao de URLs publicas de midia.
- Bloquear localhost, IP privado e URLs nao HTTPS para midia remota.
- Offline com cacheKey e expiracao.
- Provider dev desativado em producao.
- Webhook Stripe validando assinatura.

## Responsividade

Exigir:

- Desktop com sidebar.
- Mobile com menu inferior.
- Cards no mobile onde tabelas ficariam largas.
- Botoes com minimo 44px de altura.
- Player karaoke respeitando safe-area.
- Texto sem clipping.
- Sem elementos sobrepostos.

## Testes e Validacao

Adicionar testes para:

- Slug.
- URL segura.
- Rate limit.
- Offline items.
- Dev auth nao habilitar em producao.

Comandos:

- `npm test`.
- `npm run lint`.
- `npm run build`.

## Entrega Esperada

Entregar projeto funcional com:

- Schema Prisma.
- Seed com usuario/admin de exemplo e novels.
- Rotas Next App Router.
- Componentes React.
- APIs protegidas.
- Stripe integrado.
- Google OAuth.
- Offline criptografado.
- Service Worker.
- Painel admin.
- Tema dark responsivo.
- Documentacao de variaveis `.env`.

## Variaveis de Ambiente

Use:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_ADMIN_EMAILS="admin@gmail.com"
DEV_AUTH_BYPASS="true"
DEV_AUTH_EMAIL="teste@audio-novel-br.local"
STRIPE_SECRET_KEY="..."
STRIPE_WEBHOOK_SECRET="..."
STRIPE_PREMIUM_PRICE_ID="..."
ALLOWED_MEDIA_HOSTS="cdn.exemplo.com,media.exemplo.com"
```

## Observacoes Finais

- A experiencia deve parecer um app de streaming, nao um CMS simples.
- O admin deve ser funcional e separado por paginas.
- O usuario deve conseguir usar a aplicacao em mobile com conforto.
- O fluxo offline deve priorizar seguranca e expiracao.
- O produto deve estar pronto para evoluir para banco PostgreSQL em producao.

