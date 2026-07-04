# Liberação automática de buckets R2 para áudio

## Objetivo

Permitir que administradores cadastrem capítulos individuais ou em bloco usando
qualquer bucket público do Cloudflare R2 no domínio `*.r2.dev`, sem precisar
alterar uma lista fixa a cada novo bucket.

## Validação

- Aceitar somente URLs HTTPS.
- Aceitar qualquer hostname que termine exatamente em `.r2.dev`.
- Manter os hosts adicionais configurados por `MEDIA_URL_ALLOWED_HOSTS`.
- Continuar rejeitando credenciais embutidas, endereços locais ou privados,
  HTTP e domínios semelhantes que não pertençam a `r2.dev`, como
  `r2.dev.exemplo.com`.
- Não criar uma tela administrativa: a regra automática substitui a necessidade
  de cadastrar buckets individualmente.

## Resposta da API

Quando o payload de capítulos não passar pela validação, a rota deve devolver a
primeira mensagem específica produzida pelo schema, em vez do texto genérico
`Dados invalidos.`. Assim, o formulário mostrará diretamente que uma URL ou
outro campo foi rejeitado.

Erros de conectividade com o banco, como o `P1001` observado no Aiven, permanecem
fora desta mudança porque acontecem depois da autenticação e não causaram o
`400` reproduzido pela URL do novo bucket.

## Testes

- Uma URL HTTPS em um novo bucket `*.r2.dev` deve ser aceita.
- URLs HTTP, hosts privados e domínios falsos com `r2.dev` no meio do nome devem
  continuar rejeitados.
- O lote com capítulos `96, 97, 98, 99, 100` e áudio no novo bucket deve passar
  pela validação.
- A rota deve usar a mensagem específica do erro de validação na resposta `400`.

## Critério de sucesso

Após o deploy, o lote informado deve superar a validação da API sem exigir
`MEDIA_URL_ALLOWED_HOSTS` para cada novo bucket R2. Caso outro campo esteja
inválido, o painel deve exibir o motivo específico.
