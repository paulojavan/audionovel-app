# Carregamento bloqueante no login

## Objetivo

Impedir envios duplicados do formulário de login enquanto a preparação do dispositivo e a autenticação por credenciais estiverem em andamento. O usuário deve receber uma indicação visual clara de que a operação continua ativa.

## Escopo

A alteração será restrita ao formulário de login existente. O fluxo de autenticação, as mensagens de erro, a validação das credenciais, o destino após o sucesso e as regras de dispositivo permanecem inalterados.

## Comportamento

Ao enviar um formulário válido, o cliente ativa imediatamente uma trava de submissão e exibe um overlay que cobre toda a janela. O overlay usa fundo escuro, um indicador circular animado e a mensagem `Entrando...`.

Enquanto a trava estiver ativa:

- uma nova submissão é ignorada mesmo antes de o React concluir uma nova renderização;
- os controles do formulário ficam desabilitados;
- o botão de login não pode ser acionado novamente;
- o overlay intercepta a interação com a página.

Se a autenticação for concluída com sucesso, o overlay permanece visível até a navegação por `window.location.href`. Se a preparação do dispositivo ou a autenticação falhar, o overlay desaparece, a mensagem de erro atual é exibida e o formulário volta a aceitar uma tentativa.

## Implementação

O `LoginForm` passará a usar um estado explícito de submissão para representar toda a operação assíncrona. Uma referência síncrona será usada como trava contra eventos duplicados no intervalo entre o primeiro envio e a renderização do estado ocupado.

O overlay será renderizado somente durante a submissão e ficará no próprio componente, sem criar uma infraestrutura global. Ele seguirá o padrão visual já usado pelo modal de download de áudio, com posicionamento fixo, camada superior e círculo construído com bordas e `animate-spin`.

O formulário indicará o estado ocupado por meio de `aria-busy`. O overlay terá semântica de diálogo modal, nome acessível e mensagem de status, sem botão de fechamento, pois seu ciclo de vida depende exclusivamente do resultado da autenticação.

## Tratamento de erros

As mensagens existentes serão preservadas:

- limite de tentativas continua exibindo a mensagem específica;
- credenciais rejeitadas continuam exibindo `E-mail ou senha invalidos.`;
- falhas de dispositivo ou conexão continuam exibindo a mensagem de preparação do dispositivo.

Todas as saídas de falha liberam a trava e removem o overlay. A saída de sucesso não libera a interface antes da navegação.

## Testes

Um teste de regressão verificará que o formulário:

- possui uma trava síncrona contra submissões duplicadas;
- ativa o estado ocupado antes das operações assíncronas;
- desabilita o botão enquanto estiver ocupado;
- renderiza um overlay de tela inteira com indicador circular;
- mantém o estado ocupado durante a navegação bem-sucedida;
- libera o formulário em todas as falhas tratadas.

A suíte completa, o lint e o build serão executados antes da conclusão.
