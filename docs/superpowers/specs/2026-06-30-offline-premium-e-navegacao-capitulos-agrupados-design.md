# Offline Premium e Navegação de Capítulos Agrupados

## Objetivo

Corrigir a autorização do download offline para usuários Premium e tornar a reprodução de capítulos agrupados mais direta: clicar em uma parte deve posicionar e iniciar o áudio, enquanto controles no player devem permitir avançar e retroceder entre as partes do agrupamento.

## Causa do erro offline

`POST /api/offline/prepare` usa `requireUser()` e verifica o resultado com `hasPremiumAccess()`. A seleção `REQUIRE_USER_SELECT` deixou de buscar `subscriptionStatus` e `premiumUntil`, portanto a verificação recebe esses campos como ausentes e rejeita usuários Premium.

A correção deve restaurar somente os campos necessários à autorização Premium na seleção compartilhada, mantendo a consulta pequena. O teste da seleção deve exigir esses campos para impedir nova regressão.

## Reprodução de capítulos agrupados

`AudioPlayer` continuará sendo o proprietário do elemento de áudio, do tempo atual e do estado de reprodução. `ChapterPartLinks` enviará ao player a posição solicitada com a intenção explícita de reproduzir. O player posicionará o áudio no início da parte, aplicará volume e velocidade atuais, iniciará a reprodução e apresentará a mesma mensagem de erro já usada quando o navegador recusar `play()`.

O clique em qualquer título de parte agrupada também continuará rolando a página até o player.

## Controles entre partes

Quando houver mais de uma parte em `chapterParts`, os controles principal e do modo karaokê exibirão:

- capítulo agrupado anterior;
- retroceder 10 segundos;
- reproduzir ou pausar;
- avançar 10 segundos;
- próximo capítulo agrupado.

Os novos botões usarão ícones e rótulos acessíveis que deixem claro que navegam entre capítulos, não entre segundos. O botão anterior ficará desabilitado na primeira parte e o próximo ficará desabilitado na última.

A parte ativa será calculada pelo tempo absoluto do áudio e pelos intervalos `startSec` e `endSec`. Ao navegar, o player saltará para o início da parte de destino e começará a tocar. Os controles não aparecerão em capítulos sem agrupamento.

## Limites e comportamento

- A navegação ocorre dentro do mesmo arquivo de áudio e da mesma página.
- Os botões não navegam para capítulos independentes da novel.
- A opção existente de pausar entre capítulos agrupados permanece funcionando.
- Um salto manual para outra parte pode retomar a reprodução mesmo que a opção de pausa esteja ligada; a pausa volta a valer ao alcançar o fim dessa parte.
- No primeiro e no último capítulo agrupado, clicar nos controles desabilitados não altera o tempo nem a reprodução.

## Testes

Os testes automatizados devem cobrir:

- `REQUIRE_USER_SELECT` contendo `subscriptionStatus` e `premiumUntil`;
- identificação da parte ativa a partir do tempo absoluto;
- obtenção das partes anterior e seguinte;
- limites no primeiro e no último item;
- intenção de autoplay enviada ao clicar no título de uma parte.

Depois dos testes focados, a verificação final deve executar a suíte completa, lint e build.

## Contagem Premium no mobile

O cálculo de `getPremiumDaysLabel` deve usar a mesma referência de tempo tanto
para validar o acesso quanto para calcular os dias restantes. Isso evita
resultados dependentes do relógio real quando uma referência explícita é
fornecida.

No cabeçalho mobile, o texto “Audio Novel BR” ao lado da logo será removido. O
mesmo espaço exibirá `X dias de Premium`, inclusive `0 dias de Premium` para
usuários free. A apresentação desktop existente permanece inalterada.

## Contagem Premium no perfil

A tela de perfil exibirá um segundo selo ao lado de “Plano: Premium/Free” com o
resultado de `getPremiumDaysLabel(user)`. A mesma regra do cabeçalho será
reutilizada, incluindo `0 dias de Premium` para usuários free, sem criar um
cálculo paralelo.

O selo será renderizado para todo usuário autenticado. Os campos necessários,
`subscriptionStatus` e `premiumUntil`, já pertencem à seleção mínima do perfil.
