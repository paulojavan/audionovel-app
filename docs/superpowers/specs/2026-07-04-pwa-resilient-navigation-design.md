# Navegação resiliente do PWA

## Objetivo

Impedir que uma falha momentânea de conexão prenda o usuário em `/offline`.
Páginas de leitura já visitadas devem continuar navegáveis pela última versão
salva, enquanto a rede permanece a fonte preferencial quando responde.

## Rotas cobertas

O cache de navegação deve ser limitado a:

- `/`
- `/novels`
- `/novels/*`
- `/chapters/*`
- `/biblioteca`

Perfil, assinaturas, notificações, autenticação, APIs e páginas administrativas
continuam dependendo da rede. A rota `/offline` mantém seu fluxo próprio para os
áudios protegidos salvos pelo usuário.

## Estratégia de navegação

As rotas cobertas usam rede primeiro:

1. Quando a rede responde em até quatro segundos, a resposta HTML válida é entregue e
   atualiza o cache.
2. Quando a conexão falha ou demora além do limite e existe uma versão da URL
   exata no cache, a página salva é entregue sem redirecionar para `/offline`.
3. Quando a URL nunca foi visitada, o service worker mostra diretamente o
   fallback estático “Você está offline” da imagem, sem redirecionar para
   `/offline`.
4. A tentativa de rede pode concluir em segundo plano e atualizar o cache, mas
   sua falha não substitui uma resposta válida já entregue ao usuário.

O cache deve remover apenas o parâmetro interno `_rsc` do Next.js. Os demais
parâmetros continuam fazendo parte da chave porque podem alterar o conteúdo
exibido.

## Isolamento por conta

As páginas ficam no cache associado ao escopo da conta ativa. O layout inclui um
marcador com essa identidade, e a resposta só pode ser publicada quando o
marcador corresponder à conta atual. Páginas públicas podem ser salvas no escopo
anônimo; a biblioteca nunca pode ser servida nesse escopo nem reaproveitada por
outra conta.

Ao trocar de conta, o service worker muda de escopo antes de consultar páginas
salvas. Caches de outras contas não participam da resolução da navegação atual.

## Links quando offline

Quando `navigator.onLine` indicar ausência de rede, cliques em links internos das
rotas cobertas devem usar navegação completa. Isso permite que o service worker
responda com o documento HTML salvo, em vez de deixar o roteador cliente do
Next.js aguardando uma resposta RSC que depende da rede.

Links externos, downloads, novas abas, ações com modificadores e rotas fora do
escopo não devem ser interceptados.

## Atualização do service worker

O número da versão do cache deve ser incrementado para ativar a nova estratégia
nos PWAs instalados e impedir que regras antigas continuem redirecionando todas
as falhas para `/offline`.

## Testes

- Uma rota coberta usa a resposta da rede e a salva no cache correto.
- Uma falha ou demora da rede entrega a versão exata já visitada.
- Uma URL inédita usa o fallback estático “Você está offline”, sem redirecionar
  para `/offline` e sem criar ciclo para uma página que já esteja salva.
- A biblioteca de uma conta não é servida para outra conta nem para visitantes
  anônimos.
- Rotas privadas fora da lista não são persistidas.
- Links internos cobertos usam navegação completa somente quando offline.
- A recuperação da rede volta a atualizar as páginas normalmente.

## Critério de sucesso

Com conexão instável ou ausente, o usuário consegue navegar entre início,
catálogo, novels, capítulos e biblioteca que já tenha visitado. Páginas inéditas
mostram a tela estática “Você está offline”; `/offline` permanece reservado aos
áudios salvos, e nenhuma página de uma conta é reutilizada por outra.
