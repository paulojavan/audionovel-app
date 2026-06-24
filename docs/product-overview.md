# Audio Novel BR - Product Overview

## 1. Visao Geral

Audio Novel BR e uma aplicacao web em tema dark para consumo de novels em audio, com experiencia inspirada em apps de streaming como Spotify. O produto combina catalogo de obras, capitulos em audio ou video do YouTube, texto sincronizado, modo karaoke, comentarios, favoritos, historico de escuta, assinatura premium, modo offline protegido e painel administrativo completo.

O objetivo principal e permitir que usuarios descubram, acompanhem e oucam novels online ou offline, enquanto administradores gerenciam conteudo, usuarios, comentarios, assinaturas, planos e indicadores financeiros.

## 2. Publico-Alvo

- Leitores/ouvintes de web novels, light novels e historias seriadas.
- Usuarios que querem acompanhar texto enquanto escutam audio.
- Usuarios premium que desejam ouvir capitulos offline.
- Administradores/editoras/narradores que precisam publicar e monetizar capitulos.

## 3. Proposta de Valor

- Ouvir novels com player dedicado para audio narrado.
- Alternar entre modo pagina e modo karaoke sincronizado ao texto.
- Continuar a escuta de onde parou.
- Salvar capitulos offline de forma criptografada para usuarios premium.
- Organizar obras por volumes, capitulos, tags e autores.
- Monetizar capitulos premium com Mercado Pago.
- Moderar comunidade com comentarios, respostas, edicoes e notificacoes.
- Administrar usuarios, planos, financas e conteudo em uma unica area.

## 4. Stack Tecnica Atual

- Framework: Next.js 16 App Router.
- UI: React 19, Tailwind CSS 4 e lucide-react.
- Autenticacao: NextAuth com Google OAuth e provider local de desenvolvimento.
- Banco: Prisma ORM com SQLite.
- Pagamentos: Mercado Pago Checkout Pro e webhook de pagamentos.
- Validacao: Zod.
- Audio/cache: IndexedDB, Web Crypto API AES-GCM, Service Worker para pagina offline.
- Testes: node:test com tsx.
- Build/lint: Next build e ESLint.

## 5. Identidade Visual

- Nome do produto: Audio Novel BR.
- Tema: dark.
- Paleta principal:
  - Fundo profundo: preto/verde muito escuro.
  - Painel: azul-petroleo escuro.
  - Destaque: ciano/turquesa.
  - Acoes primarias: turquesa com texto escuro.
  - Avisos/erros: amarelo/vermelho em tons com baixo brilho.
- Logo: livro aberto, microfone e onda sonora em tons de turquesa.

## 6. Experiencia Publica

### 6.1 Landing Page

Usuarios nao autenticados acessam uma landing page com:

- Hero com marca Audio Novel BR.
- Chamada para ouvir novels com texto sincronizado.
- Links para login e cadastro.
- Cards explicando player imersivo, offline protegido e premium.
- Seccao informativa sobre biblioteca, avaliacoes e audio + texto.

### 6.2 Restricao Para Nao Logados

Usuarios nao autenticados devem ter acesso apenas a:

- Landing page.
- Login.
- Cadastro.
- Rotas publicas de autenticacao.

Demais paginas protegidas redirecionam para login.

## 7. Autenticacao e Sessao

### 7.1 Login com Google

O sistema usa Google OAuth via NextAuth.

Fluxo:

1. Usuario clica em Entrar com Google.
2. Google autentica o usuario.
3. O sistema cria ou atualiza o usuario local usando o email retornado.
4. Usuarios listados em `GOOGLE_ADMIN_EMAILS` podem ser criados como admin no primeiro login.
5. Usuarios bloqueados sao redirecionados para aviso de bloqueio.
6. Se novos cadastros estiverem desativados, novos usuarios nao-admin nao conseguem criar conta.

### 7.2 Login de Desenvolvimento

Existe um provider de desenvolvimento:

- Ativado apenas com `DEV_AUTH_BYPASS=true`.
- Nunca habilitado em `NODE_ENV=production`.
- Usa `DEV_AUTH_EMAIL` ou `teste@audio-novel-br.local`.
- Permite testar a aplicacao pulando o Google OAuth, mas mantendo sessao real do NextAuth.

### 7.3 Usuario Bloqueado

Usuarios bloqueados nao acessam a aplicacao. A sessao e encerrada/redirecionada para login com aviso.

## 8. Navegacao e Layout

### 8.1 Desktop

Usuarios autenticados veem:

- Sidebar fixa.
- Logo.
- Links principais: Inicio, Novels, Biblioteca, Offline, Notificacoes, Assinaturas quando aplicavel, Admin quando aplicavel.
- Card de perfil.
- Header superior com estado da sessao e menu do usuario.

### 8.2 Mobile

Usuarios autenticados veem:

- Header compacto.
- Menu inferior fixo com acoes principais.
- Itens com area de toque adequada.
- Conteudo com espaco inferior para nao ficar coberto pelo menu.

## 9. Pagina Inicial Autenticada

Quando logado, o usuario ve:

- Hero interno com chamada para ouvir capitulos.
- Recomendacoes baseadas nas novels avaliadas positivamente.
- Fallback de recomendacoes com obras recentes/populares.
- Ranking alternavel entre:
  - Mais vistas.
  - Melhor avaliadas.
- Cards de novels com capa, titulo, autor e nota media.

## 10. Catalogo de Novels

### 10.1 Listagem

Pagina `/novels` com:

- Pesquisa por titulo, autor e sinopse.
- Filtro por tag.
- Filtro por autor via link.
- Paginacao.
- Cards de novels com:
  - Capa.
  - Titulo.
  - Autor clicavel.
  - Media de estrelas.
  - Tags clicaveis.

### 10.2 Tags

Tags podem ser cadastradas no admin e associadas a novels. No catalogo e na pagina da novel, clicar em uma tag abre o catalogo filtrado por ela.

### 10.3 Autor

Autor aparece em destaque e como link para filtrar o catalogo por todas as obras daquele autor.

## 11. Pagina da Novel

A pagina de uma novel contem:

- Capa.
- Titulo.
- Sinopse.
- Autor clicavel.
- Contador de visualizacoes.
- Tags clicaveis.
- Sistema de nota por estrelas.
- Botao de favoritar.
- Lista de volumes e capitulos.
- Comentarios da novel.

### 11.1 Volumes e Capitulos

Volumes sao exibidos em acordeons expansivos/contrativeis.

No desktop:

- Tabela com Vol/Cap, titulo, data e offline.

No mobile:

- Cards por capitulo para evitar tabela larga.

Cada capitulo mostra:

- Tipo: audio ou YouTube.
- Duracao ou indicador YouTube.
- Plays.
- Estado Free/Premium.
- Marcacao de ouvido com tom esverdeado.
- Botao de offline ou status de indisponibilidade.

### 11.2 Offline na Pagina da Novel

O botao de ouvir offline fica na pagina da novel, por capitulo.

Regras:

- Somente usuarios premium podem salvar offline.
- Capitulos do YouTube mostram offline indisponivel.
- Capitulos de audio podem ser preparados para cache criptografado.

## 12. Pagina do Capitulo

### 12.1 Cabecalho

Mostra:

- Nome da obra.
- Volume.
- Numero do capitulo.
- Titulo em destaque.
- Duracao ou YouTube.
- Capa da obra.
- Botao de voltar para a novel.
- Reacoes do capitulo.
- Links de capitulo anterior/proximo.
- Link de edicao para admin.

### 12.2 Capitulos de Audio

Capitulos de audio exibem o player customizado com:

- Botao play/pause.
- Barra de progresso.
- Tempo ouvido e duracao.
- Botao -10s.
- Botao +10s.
- Seletor de modo de reproducao:
  - Karaoke.
  - Pagina.
- Texto do capitulo abaixo.
- Controles de volume e velocidade no modo pagina quando tocando.

### 12.3 Modo Karaoke

Ao tocar em play no modo karaoke:

- Abre tela imersiva fullscreen.
- Fundo preto com capa da novel em baixa opacidade.
- Frase atual centralizada.
- Frase anterior e proxima com opacidade menor.
- Rodape com play/pause, -10s, +10s, progresso, volume, velocidade e ajuste de fonte.
- Ao finalizar, sai automaticamente do modo karaoke.
- O tamanho de fonte pode ser aumentado ou diminuido.

### 12.4 Modo Pagina

Ao tocar em play no modo pagina:

- Permanece na pagina do capitulo.
- Exibe controles de volume e velocidade.
- Mantem texto do capitulo e comentarios visiveis.

### 12.5 Capitulos do YouTube

Capitulos com link do YouTube:

- Nao exigem timestamps.
- Exibem apenas o player de video embutido.
- Ao abrir a pagina, contam como visualizacao.
- Sao adicionados ao historico como vistos.
- Nao podem ser salvos offline.

## 13. Progresso de Escuta

O sistema salva onde o usuario parou:

- Ao iniciar.
- Ao pausar.
- Ao finalizar.

O progresso inclui:

- Usuario.
- Capitulo.
- Posicao em segundos.
- Duracao.
- Status concluido.

O historico aparece na biblioteca e tambem nas estatisticas do admin.

## 14. Cache de Audio e Offline

### 14.1 Cache Temporario

Audios tocados online sao armazenados temporariamente no IndexedDB de forma criptografada.

Regras:

- Cache temporario expira em 2 dias.
- Limpeza automatica.
- Evita baixar varias vezes o mesmo arquivo.

### 14.2 Offline Premium

Audios offline:

- Disponiveis apenas para premium.
- Criptografados no navegador com Web Crypto.
- Registrados no banco com `cacheKey` e `expiresAt`.
- Expiram em 7 dias.
- Ficam listados na pagina `/offline`.
- Sao limpos automaticamente quando expiram.

### 14.3 Pagina Offline

A pagina `/offline` permite:

- Ver capitulos salvos offline.
- Agrupar por novel.
- Expandir/contrair capitulos por obra.
- Tocar audio offline.
- Usar play/pause.
- Avancar/retroceder 10s.
- Controlar volume.
- Controlar velocidade.
- Usar barra de progresso.

### 14.4 Service Worker

Existe service worker para permitir carregar a pagina offline e assets basicos mesmo sem internet, especialmente a rota offline.

## 15. Biblioteca do Usuario

Pagina `/biblioteca` com:

- Ultimos capitulos ouvidos.
- Estado visto ou posicao onde parou.
- Favoritos.
- Links para capitulos e novels.

## 16. Perfil do Usuario

Pagina `/perfil` com:

- Nome.
- Email.
- Plano atual.
- Botao para assinar caso nao seja premium.
- Historico financeiro do usuario.

Observacao: com login Google, email nao e editavel dentro do app.

## 17. Notificacoes

Pagina `/notificacoes` com:

- Notificacoes nao lidas.
- Ultimas notificacoes.
- Limite base de 20 ultimas, podendo exceder para incluir nao lidas.
- Botao para marcar todas como lidas.
- Link direto para o comentario/capitulo/novel relacionado.

Notificacoes sao usadas principalmente para respostas aprovadas em comentarios.

## 18. Comentarios e Comunidade

### 18.1 Comentarios em Novels e Capitulos

Usuarios logados podem comentar em:

- Pagina da novel.
- Pagina do capitulo.

### 18.2 Respostas

Cada comentario possui botao sutil "Responder". Ao clicar, abre caixa de texto para digitar resposta.

### 18.3 Edicao

Usuarios podem editar seus comentarios.

Regra importante:

- Comentario editado volta para moderacao, mesmo se ja estava aprovado.

### 18.4 Moderacao

Comentarios podem ter status:

- PENDING.
- APPROVED.
- REMOVED.

Comentarios removidos aparecem na postagem como "Comentario removido pelo administrador".

## 19. Reacoes e Avaliacoes

### 19.1 Novels

Novels usam sistema de notas por estrelas.

- Usuario escolhe nota de 1 a 5.
- Sistema calcula media e quantidade de notas.
- Media aparece em cards, catalogo, ranking e pagina da obra.

### 19.2 Capitulos

Capitulos mantem sistema de like/dislike.

- Botao like.
- Botao dislike.
- Contadores.

## 20. Assinaturas e Premium

### 20.1 Planos

Planos de assinatura sao cadastraveis no admin.

Cada plano possui:

- Nome.
- Slug.
- Descricao.
- Valor em centavos.
- Moeda.
- Intervalo.
- Ativo/inativo.
- Aceita cartao.
- Aceita Pix.
- Ordem de exibicao.

### 20.2 Pagina de Assinaturas

Usuarios podem ver:

- Plano Free.
- Planos premium ativos.
- Recursos de cada plano.
- Metodo de pagamento aceito.
- Botao de contratar.

Se o usuario ja for premium, a aba de assinaturas pode ficar oculta na navegacao principal.

### 20.3 Mercado Pago

Fluxo:

1. Usuario clica em contratar.
2. API cria preferencia de pagamento Mercado Pago.
3. Mercado Pago redireciona para pagamento.
4. Webhook registra pagamento.
5. Usuario e liberado como premium.

Em ambiente local, se Mercado Pago nao estiver disponivel, o sistema pode ativar assinatura de teste para validar o fluxo.

### 20.4 Premium Manual

Admin pode conceder premium manualmente e editar data de expiracao.

## 21. Painel Administrativo

Admin tem area separada em `/admin`.

### 21.1 Dashboard

Mostra:

- Total de usuarios.
- Usuarios premium.
- Total de novels.
- Total de capitulos.
- Receita confirmada.
- Novels mais vistas.
- Pagamentos recentes.
- Acesso rapido para moderacao.

### 21.2 Novels/Conteudo

Funcionalidades:

- Listar novels cadastradas.
- Pesquisar novels.
- Cadastrar novel.
- Editar novel.
- Cadastrar tags.
- Selecionar tags existentes.
- Associar tags a novel.
- Abrir painel de uma novel.
- Cadastrar volumes.
- Cadastrar capitulos no volume especifico.
- Editar capitulos.
- Suportar capitulos individuais e em blocos.
- Configurar tipo AUDIO ou YOUTUBE.
- Para audio:
  - URL de audio.
  - Duracao.
  - Inicio no audio.
  - Transcript JSON/timestamps.
- Para YouTube:
  - URL do YouTube.
  - Extracao/armazenamento do videoId.
- Marcar capitulo como free ou premium.
- Publicar/despublicar.

### 21.3 Planos

Admin pode:

- Criar planos.
- Editar planos existentes.
- Ativar/desativar planos.
- Configurar valor.
- Configurar moeda.
- Configurar periodo.
- Definir cartao e/ou Pix.

### 21.4 Usuarios

Admin pode:

- Pesquisar usuarios por nome, email, perfil, plano ou status.
- Ver usuarios bloqueados/ativos.
- Ver plano/status de assinatura.
- Acessar tela de estatisticas.

### 21.5 Estatisticas do Usuario

Tela individual mostra:

- Plano atual.
- Quantidade de compras premium.
- Quantidade de premium manual.
- Total pago.
- Quantidade de comentarios.
- Novels acompanhadas por favoritos e historico.
- Historico de mensagens.
- Observacoes privadas do admin.
- Botao de bloqueio/desbloqueio.
- Concessao/edicao de premium manual.

### 21.6 Moderacao

Admin pode:

- Ver comentarios pendentes.
- Ver comentarios removidos.
- Aprovar comentario.
- Remover comentario.
- Auditar comentario removido.
- Identificar respostas e comentarios editados.

### 21.7 Financeiro

Admin pode:

- Ver receita confirmada.
- Ver quantidade de pagamentos aprovados.
- Ver outros status de pagamento.
- Ver lista de transacoes recentes.
- Ver usuario, descricao, valor, status e data.

### 21.8 Configuracoes

Admin pode:

- Ativar/desativar novos cadastros.
- Ativar/desativar compras de assinaturas.

## 22. Seguranca

Medidas atuais:

- Rotas protegidas por proxy/middleware.
- Admin protegido por role.
- Usuarios bloqueados sao impedidos de acessar.
- Auth com NextAuth JWT.
- Credenciais sensiveis via `.env`.
- Google OAuth.
- Provider dev bloqueado em producao.
- Rate limit para comentarios, offline e audio.
- Validacao com Zod.
- Sanitizacao/validacao de URLs de midia.
- Bloqueio de hosts privados/localhost em URLs publicas de midia.
- Audio offline com cacheKey e expiracao.
- Audio no navegador criptografado com Web Crypto.
- Comentarios removidos preservam auditoria.

## 23. Performance e Otimizacoes

- Cache temporario de audio por 2 dias.
- Offline premium por 7 dias.
- Salvamento de progresso em pontos importantes em vez de a cada segundo.
- Service worker para assets offline.
- IndexedDB para armazenamento local.
- Componentes server para dados pesados.
- Componentes client apenas onde ha interatividade.
- Ranking dinamico no client.
- Paginacao no catalogo.

## 24. Responsividade

- Layout desktop com sidebar.
- Layout mobile com menu inferior.
- Cards mobile para capitulos.
- Tabelas mantidas apenas em desktop quando necessario.
- Botoes com areas de toque ampliadas.
- Player mobile redesenhado para nao sobrepor conteudo.
- Karaoke com rodape adaptado a safe-area.

## 25. Entidades Principais

- User.
- Novel.
- Tag.
- NovelTag.
- Volume.
- Chapter.
- ListeningProgress.
- Favorite.
- NovelReaction.
- ChapterReaction.
- Comment.
- Notification.
- PaymentTransaction.
- SubscriptionPlan.
- ManualSubscription.
- OfflineDownload.
- SystemSetting.

## 26. Regras de Negocio Principais

- Apenas usuarios logados podem acessar conteudo interno.
- Capitulos premium exigem premium ativo ou admin.
- Offline e apenas para premium.
- YouTube nao tem offline.
- Comentario novo entra como pendente.
- Comentario editado volta para pendente.
- Comentario removido continua visivel como removido pelo admin.
- Resposta aprovada gera notificacao ao dono do comentario pai.
- Novos cadastros podem ser desativados.
- Compras de assinatura podem ser desativadas.
- Admin pode conceder premium manualmente.
- Cache temporario expira em 2 dias.
- Offline expira em 7 dias.

## 27. Rotas Principais

Publicas:

- `/`
- `/login`
- `/cadastro`

Usuario autenticado:

- `/`
- `/novels`
- `/novels/[slug]`
- `/chapters/[id]`
- `/biblioteca`
- `/offline`
- `/perfil`
- `/notificacoes`
- `/assinaturas`

Admin:

- `/admin`
- `/admin/configuracoes`
- `/admin/conteudo`
- `/admin/conteudo/novo`
- `/admin/conteudo/[id]`
- `/admin/conteudo/[id]/editar`
- `/admin/conteudo/capitulos/[id]/editar`
- `/admin/planos`
- `/admin/usuarios`
- `/admin/usuarios/[id]`
- `/admin/moderacao`
- `/admin/financeiro`

APIs:

- `/api/auth/[...nextauth]`
- `/api/billing/checkout`
- `/api/billing/webhook`
- `/api/chapters/[id]/audio`
- `/api/comments`
- `/api/comments/[id]`
- `/api/favorites`
- `/api/notifications/read`
- `/api/offline/prepare`
- `/api/progress`
- `/api/reactions`
- `/api/admin/*`

## 28. Estado Atual do Produto

O produto ja cobre:

- Autenticacao Google.
- Login dev para teste.
- Landing page.
- Catalogo com filtros.
- Pagina de novel.
- Player de audio e karaoke.
- YouTube.
- Biblioteca.
- Offline criptografado.
- Comentarios com respostas e moderacao.
- Notificacoes.
- Assinaturas via Mercado Pago/teste local.
- Painel admin multiabas.
- Gestao financeira.
- Responsividade mobile.
