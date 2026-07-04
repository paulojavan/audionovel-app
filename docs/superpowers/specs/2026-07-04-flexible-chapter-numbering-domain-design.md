# Numeração flexível de capítulos e troca de domínio

## Objetivo

Permitir capítulos com número zero e números intermediários, como `0`, `8.5` e `9`, sem quebrar a ordenação, os capítulos agrupados ou a navegação. Confirmar e proteger a paginação da lista administrativa de usuários. Preparar o projeto para o domínio público `https://audionovelbr.com.br`.

## Numeração de capítulos

Os campos `Chapter.position` e `Chapter.positionEnd` passam de `Int` para `Float` no Prisma. A API administrativa aceita números finitos maiores ou iguais a zero. Os formulários de criação e edição usam campos numéricos com `min="0"` e `step="any"`.

O campo `position` continua sendo a fonte única para identificação editorial e ordenação. Não será criado um segundo campo de rótulo ou ordem. Um capítulo de posição zero e título “Prefácio” será exibido como `Cap. 0 - Prefácio`; um capítulo intermediário será exibido como `Cap. 8.5 - <título>`.

Os capítulos agrupados continuam representando sequências inteiras consecutivas. Seu cálculo de próxima posição permanece baseado no maior `positionEnd` ou `position`, acrescentando `1`. Capítulos avulsos decimais podem ser inseridos entre capítulos existentes sem alterar essa regra.

Uma migração SQL para Aiven/PostgreSQL converterá as colunas `position` e `positionEnd` para `DOUBLE PRECISION`, preservando os dados e a restrição única existente em `(volumeId, position)`.

## Superfícies afetadas

Serão atualizados:

- schema Prisma e cliente gerado;
- validação da API administrativa;
- campos de cadastro e edição;
- tipos compartilhados de capítulos;
- formatação, ordenação e cálculo da próxima posição;
- testes de validação, rótulo, sequência e agrupamento.

As listagens públicas, administrativas, navegação anterior/próximo, progresso e modo offline continuarão usando a posição numérica, agora com suporte a decimais.

## Paginação de usuários

A tela `src/app/admin/usuarios/page.tsx` já pagina no servidor em blocos de 50 registros, usa `skip` e `take`, conta o total, preserva a busca nos links e desabilita os limites anterior/próximo.

Não será criada uma segunda implementação. A lógica de normalização da página e construção dos links será isolada em uma unidade testável e usada pela página. Os testes cobrirão página inválida, limites e preservação do parâmetro de busca.

## Novo domínio

O metadata root declarará `metadataBase` como `https://audionovelbr.com.br` e canonical `/`, permitindo que o Next.js gere URLs absolutas consistentes para SEO e compartilhamento. Fixtures de teste que usam o domínio antigo serão atualizadas para o novo domínio.

Será criado um checklist de implantação cobrindo:

- `NEXTAUTH_URL=https://audionovelbr.com.br`;
- `NEXT_PUBLIC_APP_URL=https://audionovelbr.com.br`;
- DNS, certificado TLS e domínio no proxy/Coolify;
- URL pública de webhook do Mercado Pago;
- URLs de callback de qualquer provedor OAuth que venha a ser configurado;
- redirecionamento HTTP 301 do domínio antigo para o novo;
- validação do manifest, service worker, recuperação de senha, checkout e retorno de pagamento.

O manifest e o service worker usam caminhos relativos e permanecem válidos no novo domínio. Como armazenamento, cookies, service workers e instalação PWA são vinculados à origem, dados offline e a instalação do domínio antigo não migram automaticamente; o usuário precisará entrar e instalar novamente no novo domínio.

## Tratamento de erros e compatibilidade

Valores negativos, não numéricos ou infinitos serão rejeitados pela API. A restrição única continuará impedindo dois capítulos com a mesma posição no mesmo volume.

Dados inteiros existentes permanecem numericamente equivalentes após a conversão. Rótulos não exibirão `.0`, pois números inteiros continuam formatados como inteiros por `String(number)`.

## Estratégia de testes

O trabalho seguirá TDD:

1. testes falham para posição `0`, posição `8.5`, rótulos e sequência;
2. implementação mínima faz esses testes passarem;
3. testes protegem paginação e domínio;
4. execução de toda a suíte, lint e build;
5. subagentes independentes revisam o diff e repetem verificações relevantes;
6. commit final e push somente se não houver erros.

## Critérios de aceite

- O administrador consegue criar e editar `Cap. 0 - Prefácio`.
- O administrador consegue manter capítulos `8`, `8.5` e `9` no mesmo volume.
- As três posições aparecem na ordem correta em todas as listas e na navegação.
- Capítulos agrupados existentes continuam funcionando.
- A lista de usuários mantém paginação de 50 registros e preserva a busca.
- Metadados e documentação apontam para `https://audionovelbr.com.br`.
- Testes, lint, build e revisões dos subagentes terminam sem erro antes do push.
