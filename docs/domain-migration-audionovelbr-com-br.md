# Migração para audionovelbr.com.br

## Configuração no Coolify

Atualize as variáveis de ambiente da aplicação e faça um novo deploy:

```env
NEXTAUTH_URL=https://audionovelbr.com.br
NEXT_PUBLIC_APP_URL=https://audionovelbr.com.br
```

## DNS, TLS e domínio principal

- Aponte o DNS de `audionovelbr.com.br` para a aplicação no Coolify.
- Adicione `audionovelbr.com.br` aos domínios da aplicação e aguarde a emissão do certificado TLS.
- Defina `https://audionovelbr.com.br` como domínio principal.
- Mantenha o domínio antigo ativo durante a transição e configure um redirect HTTP 301 para o novo domínio, preservando todo o path e a query string.

Exemplo: `https://audionovelbr.qzz.io/novels/exemplo?origem=pwa` deve redirecionar para `https://audionovelbr.com.br/novels/exemplo?origem=pwa`.

## Integrações externas

- No Mercado Pago, cadastre o novo webhook `https://audionovelbr.com.br/api/billing/webhook` e confirme que notificações reais chegam à aplicação.
- Se login OAuth estiver em uso, atualize os callbacks autorizados de cada provedor para o novo domínio.

## Validação após o deploy

- Confirme que `https://audionovelbr.com.br/manifest.webmanifest` responde com o content type de manifest, e não HTML.
- Valide login e logout no novo domínio.
- Solicite uma recuperação de senha e abra o link recebido.
- Execute um checkout, confirme o webhook e valide o retorno para a aplicação.
- Teste manualmente os redirects do domínio antigo com paths e queries diferentes.

## PWA e modo offline

A origem da aplicação mudou. Desinstale a PWA antiga e instale novamente pelo novo domínio. Capítulos salvos offline na origem anterior não são transferidos; salve-os novamente depois da reinstalação.
