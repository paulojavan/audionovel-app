# Estado visual de Premium expirado

## Problema

O acesso Premium já é calculado corretamente por `hasPremiumAccess`: a conta só
é Premium quando o status permite acesso e `premiumUntil` está no futuro.
Entretanto, algumas superfícies exibem diretamente os campos persistidos
`plan` e `subscriptionStatus`. Como esses campos permanecem `PREMIUM` e
`ACTIVE` depois do vencimento, a interface pode mostrar estados contraditórios.

## Regra de produto

O estado exibido deve ser derivado da validade efetiva:

- acesso Premium válido: plano `Premium`;
- Premium anteriormente ativo, mas vencido: plano `Free` e status `Expirado`;
- conta sem Premium válido nem vencido: plano `Free` e status `Inativo`;
- Premium válido: status `Ativo`;
- administrador continua identificado como `Admin` no menu.

O instante de vencimento é exclusivo: quando `premiumUntil` for igual ou
anterior ao horário atual, o Premium já está expirado.

## Arquitetura

Uma função pura e compartilhada em `src/lib/subscription.ts` produzirá o estado
de apresentação com base em `plan`, `subscriptionStatus`, `premiumUntil` e um
horário opcional para testes. Ela distinguirá uma assinatura Premium vigente
do acesso privilegiado concedido ao papel `ADMIN`, retornando rótulos prontos
para a interface. A autorização continuará usando `hasPremiumAccess`; o estado
comercial exibido não transformará administradores em assinantes Premium.

Não haverá atualização automática dos campos históricos no banco. Isso evita
cron jobs, gravações durante renderização e perda do estado que originou o
vencimento.

## Superfícies afetadas

- O layout calculará o plano efetivo no servidor e o passará ao menu do
  usuário, evitando que o componente cliente exiba `user.plan` diretamente.
- A lista administrativa de usuários exibirá o plano e o status efetivos.
- O contador Premium do dashboard administrativo considerará apenas usuários
  com status de acesso válido e `premiumUntil` no futuro.
- Perfil, detalhe administrativo, assinaturas e autorização continuarão usando
  a regra compartilhada já existente.

## Busca administrativa

Esta correção altera apresentação e contagem. A pesquisa continuará consultando
os campos persistidos; ela não será convertida em um mecanismo de busca por
estado derivado nesta mudança.

## Testes

- estado Premium com validade futura;
- estado Free/Expirado com data passada;
- vencimento exatamente no horário atual;
- estado Free sem histórico Premium;
- administrador identificado como Admin;
- testes de integração estática garantindo que menu, lista e dashboard não
  voltem a usar apenas os campos persistidos.

## Banco de dados

Nenhuma alteração de schema ou dados na Aiven é necessária.
