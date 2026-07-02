# Allowlist de imagens do WordPress

## Problema

Capas servidas por `i1.wp.com` falham no `next/image` porque a configuração atual permite somente `i0.wp.com`.

## Decisão

Permitir explicitamente os quatro shards conhecidos do proxy de imagens do WordPress:

- `i0.wp.com`
- `i1.wp.com`
- `i2.wp.com`
- `i3.wp.com`

Não será usado wildcard como `*.wp.com`. Hosts adicionais continuarão dependendo de `IMAGE_URL_ALLOWED_HOSTS`.

## Consistência

A lista será atualizada em dois pontos:

1. `next.config.ts`, responsável por `images.remotePatterns` e CSP;
2. `src/lib/url-security.ts`, responsável pela validação das capas cadastradas.

Um teste verificará que os quatro hosts estão configurados e que a configuração global `hostname: "**"` continua proibida.

## Verificação

Executar o teste focado, `npm run lint` e `npm run build`. Como `next.config.ts` é carregado na inicialização, o servidor de desenvolvimento precisa ser reiniciado depois da mudança.
