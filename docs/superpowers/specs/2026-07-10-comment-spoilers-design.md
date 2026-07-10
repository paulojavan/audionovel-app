# Spoilers em comentários

## Objetivo

Permitir que usuários ocultem trechos de spoilers em comentários e respostas usando a sintaxe `[spoiler]texto[/spoiler]`. Na exibição pública, o trecho permanece ilegível até ser revelado por uma ação explícita do leitor.

## Sintaxe

A sintaxe reconhecida é:

```text
[spoiler]trecho oculto[/spoiler]
```

As tags são minúsculas e exatas. Um comentário pode conter vários pares independentes, no meio de frases ou abrangendo quebras de linha.

## Regras de comportamento

- O conteúdo entre um par válido de tags começa oculto.
- O espaço ocupado pelo spoiler mostra `Spoiler — clique para revelar`.
- Clicar ou ativar pelo teclado revela somente aquele trecho.
- Depois de revelado, o trecho permanece visível até a página ser recarregada.
- Spoilers diferentes no mesmo comentário são revelados de forma independente.
- Tags incompletas, vazias, escritas incorretamente ou aninhadas aparecem literalmente como texto comum.
- Comentários existentes que já contenham pares válidos também passam a usar a apresentação de spoiler.
- Comentários removidos continuam mostrando apenas a mensagem de remoção.

## Orientação ao usuário

Os formulários de novo comentário, resposta e edição devem mostrar o texto:

```text
Use [spoiler]texto[/spoiler] para ocultar spoilers.
```

A orientação fica próxima ao textarea e não substitui os placeholders ou mensagens de validação existentes.

## Arquitetura

Um módulo puro será responsável por transformar o corpo do comentário em uma sequência ordenada de segmentos:

- `text`, contendo texto público;
- `spoiler`, contendo texto inicialmente oculto.

O parser não altera o texto persistido. Banco de dados, schemas das APIs e fluxo de moderação continuam armazenando o corpo original com as tags.

Um componente cliente focado receberá o corpo bruto, chamará o parser e controlará em estado local os índices já revelados. `CommentThread` continuará responsável pela estrutura da discussão e delegará somente a renderização do corpo aprovado para esse componente.

## Parsing

O parser percorrerá o texto linearmente, preservando ordem, espaços e quebras de linha. Um par é válido somente quando:

1. possui abertura `[spoiler]` e fechamento `[/spoiler]`;
2. contém pelo menos um caractere;
3. não contém outra tag de abertura ou fechamento de spoiler.

Quando uma sequência não cumprir todas as regras, a sequência será devolvida como texto comum. O parser deve sempre avançar e nunca lançar erro por conteúdo fornecido pelo usuário.

## Segurança e acessibilidade

- Todo conteúdo será renderizado como filhos de elementos React.
- Não será usado `dangerouslySetInnerHTML`, interpretação de Markdown ou HTML do usuário.
- O controle oculto será um botão operável por teclado.
- Antes da revelação, usará `aria-expanded="false"`; após o clique, o conteúdo revelado terá o estado expandido correspondente.
- O texto visível do controle comunica que existe um spoiler sem expor seu conteúdo.

## Superfícies

- Comentários principais em páginas de novels.
- Respostas em páginas de novels.
- Comentários principais em páginas de capítulos.
- Respostas em páginas de capítulos.
- Formulário de criação, formulário compacto de resposta e formulário de edição.

A moderação administrativa e o histórico administrativo do usuário continuam mostrando o conteúdo bruto e as tags. Administradores precisam ler todo o texto para moderar, e essa tela não é uma superfície pública de consumo.

## Limites e validação

As tags fazem parte do corpo e contam no limite atual de 1.200 caracteres. A validação atual de mínimo, máximo, moderação e propriedade de edição permanece inalterada.

## Testes

O desenvolvimento seguirá TDD e cobrirá:

- texto sem tags preservado integralmente;
- um spoiler entre trechos públicos;
- vários spoilers independentes;
- conteúdo com quebras de linha;
- tags incompletas, vazias e com capitalização incorreta como texto comum;
- sequências aninhadas preservadas como texto comum;
- texto parecido com HTML renderizado sem interpretação;
- estado inicial oculto e ação que revela permanentemente o segmento durante a montagem atual;
- orientação de sintaxe no comentário, na resposta e na edição;
- comentários removidos sem tentativa de parsing.

Ao final serão executados testes direcionados, suíte completa, lint e build de produção.

## Fora de escopo

- editor rico ou botão que insere a tag automaticamente;
- Markdown ou outras tags de formatação;
- esconder novamente um spoiler já revelado;
- preferência global para revelar todos os spoilers;
- ocultação de spoilers nas telas administrativas;
- alteração do limite de caracteres dos comentários.
