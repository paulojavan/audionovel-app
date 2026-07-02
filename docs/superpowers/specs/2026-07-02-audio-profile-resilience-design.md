# Resiliência do player e do perfil

## Objetivo

Corrigir três comportamentos:

1. impedir a troca do modo Página para Karaokê enquanto o áudio estiver tocando;
2. impedir requisições duplicadas causadas por cliques repetidos no link Perfil e no botão Salvar alterações;
3. tornar o streaming em segundo plano mais estável e salvar corretamente a conclusão de áudios com capítulos agrupados.

## Player e modo Karaokê

O botão Karaokê ficará desabilitado somente quando o áudio estiver tocando e o modo selecionado for Página. Pausar o áudio reabilita o botão. A mudança não interrompe a reprodução e não altera o comportamento de quem iniciou o áudio em Karaokê.

O estado desabilitado terá `disabled`, indicação visual e texto acessível explicando que é preciso pausar antes de trocar.

## Proteção contra cliques repetidos no perfil

### Link Perfil

O primeiro clique de navegação será aceito e aplicará uma trava local imediatamente, antes de a navegação começar. Cliques seguintes durante a mesma transição serão ignorados. Quando a rota mudar, a trava será liberada. Se o usuário já estiver em `/perfil`, clicar novamente não fará uma nova navegação.

### Salvar alterações

O envio usará uma função assíncrona aguardada. Uma referência síncrona bloqueará submissões concorrentes antes mesmo da próxima renderização; o estado visual manterá o botão desabilitado até a requisição terminar. A trava será liberada em sucesso ou erro.

Essas proteções são complementares ao rate limit do servidor e evitam trabalho desnecessário sem depender dele.

## Streaming em segundo plano

O proxy continuará usando streaming e requisições Range. O timeout de 15 segundos protegerá somente a espera inicial pelos cabeçalhos do provedor. Assim que a resposta começar, o temporizador será cancelado e não poderá abortar um áudio longo no meio da reprodução.

O player configurará a Media Session API quando disponível, incluindo título, novel, capa e comandos de reproduzir, pausar, avançar e retroceder. Dispositivos sem essa API continuarão funcionando normalmente.

## Progresso e conclusão

O player manterá um único fluxo de persistência:

- checkpoints periódicos, no máximo uma vez a cada 15 segundos;
- checkpoint ao pausar e em `pagehide`;
- conclusão em `ended`;
- conclusão preventiva quando a reprodução alcançar o final lógico do capítulo, com tolerância curta para dispositivos que não entregam `ended` em segundo plano.

As requisições usarão `keepalive` quando forem disparadas durante saída ou suspensão da página. Estados idênticos serão deduplicados e uma conclusão já enviada não voltará a ser gravada como incompleta.

Para capítulos agrupados, o final lógico será o final do bloco completo, não o fim de cada parte interna. A opção “Pausar entre capítulos” continuará salvando apenas progresso parcial nas divisões intermediárias.

## Tratamento de erros

Falhas de checkpoint não interromperão o áudio. A próxima oportunidade poderá tentar novamente. Falhas ao iniciar a mídia continuarão mostrando a mensagem atual. O proxy responderá `502` se não conseguir obter a resposta inicial do provedor dentro do limite.

## Testes

Serão adicionados testes de regressão para:

- bloqueio do botão Karaokê durante reprodução em modo Página;
- trava imediata e liberação das ações do perfil;
- timeout cancelado após o início do streaming;
- deduplicação e monotonicidade da conclusão;
- conclusão próxima ao fim do bloco agrupado;
- configuração segura da Media Session API.

Depois dos testes focados, serão executados `npm test`, `npm run lint` e `npm run build`.
