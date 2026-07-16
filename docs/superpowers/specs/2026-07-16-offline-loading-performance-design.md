# Carregamento Offline Imediato

## Objetivo

Fazer a página `/offline` exibir imediatamente os capítulos salvos, sem ler os arquivos de áudio durante a montagem da lista, e impedir que rede instável ou a reconciliação Premium bloqueiem a abertura.

O desenho preserva os downloads criptografados existentes e mantém a validação definitiva do arquivo para o momento em que o usuário escolher um capítulo.

## Diagnóstico confirmado

O fluxo atual executa trabalho proporcional ao número de capítulos várias vezes:

- `getSavedOfflineItems` varre o armazenamento de áudio, limpa metadados e lê cada registro;
- `OfflineListenPanel` valida novamente cada capítulo com `hasValidEncryptedAudio`;
- os itens válidos são salvos novamente, e cada salvamento repete as limpezas;
- `OfflineEntitlementSync` pode executar leituras e gravações semelhantes ao mesmo tempo;
- os registros do IndexedDB armazenam metadados e o `ArrayBuffer` criptografado juntos, portanto uma leitura destinada a verificar existência ou validade pode materializar o áudio completo;
- transações `readwrite` no mesmo object store são serializadas pelo IndexedDB, mesmo quando iniciadas com `Promise.all`.

Além disso, o service worker aguarda `fetch("/offline")` falhar antes de consultar o cache da conta. Em redes móveis degradadas, essa falha pode demorar minutos.

## Abordagens consideradas

### Leitura leve em lote — escolhida

Usar o object store de metadados existente e consultar somente as chaves do object store de áudio. A lista não abre registros de áudio. Limpezas e atualizações passam a operar em lote, e a página offline usa resposta em cache imediatamente enquanto uma atualização de rede ocorre em segundo plano.

Essa alternativa resolve o gargalo sem invalidar downloads existentes nem alterar o formato criptográfico.

### Novo formato de áudio fragmentado

Separar cada áudio em blocos criptografados para permitir descriptografia e reprodução progressivas. Também reduziria o tempo após o toque, mas exigiria novo download ou migração custosa dos arquivos existentes, além de uma alteração ampla no player.

Essa evolução fica fora deste trabalho. O formato integral AES-GCM continuará válido.

### Somente timeouts e redução de limpezas

Adicionar timeout no service worker e executar menos limpezas. Tem baixo risco, mas ainda permitiria que verificações de existência carregassem arquivos grandes. Não resolve a causa principal.

## Arquitetura

### Snapshot leve do catálogo local

Uma operação de catálogo abrirá o banco uma vez e executará uma única transação `readonly` abrangendo `offlineItems` e `audios`:

1. ler os metadados da conta;
2. ler somente as chaves de áudio com `getAllKeys`, sem acessar `AudioRecord.data`;
3. filtrar itens expirados pelo `OfflineItem.expiresAt`;
4. cruzar `chapterId` com o ID calculado do áudio offline;
5. devolver imediatamente os itens vigentes cuja chave exista.

O catálogo nunca chamará `cleanupExpiredAudioCache`, `hasValidEncryptedAudio` ou `saveOfflineItem` por capítulo.

Metadados expirados serão excluídos por suas chaves conhecidas. A exclusão do registro de áudio correspondente também usará a chave calculada, sem ler o valor. A remoção será agrupada em uma única transação `readwrite` posterior e não bloqueará a primeira renderização da lista.

### Montagem da lista

`OfflineListenPanel` chamará somente a operação leve de catálogo. Após mesclar metadados do shell e do dispositivo, exibirá os capítulos sem uma segunda rodada de validações e sem regravar itens que não mudaram.

A lista poderá mostrar um item cujo registro esteja corrompido apesar de a chave existir. Essa condição será tratada ao tocar, com remoção direcionada do item e mensagem para salvá-lo novamente. Esse é o compromisso aprovado para priorizar abertura imediata.

### Reprodução

Ao tocar em um capítulo, o app fará uma única leitura do registro selecionado, confirmará seu vencimento e então descriptografará o áudio integral no formato atual. Não haverá uma varredura global antes dessa leitura.

Se o registro estiver ausente, expirado, corrompido ou não puder ser descriptografado, apenas o capítulo afetado será retirado da lista local. Os demais permanecem disponíveis.

### Gravações e limpeza

`saveOfflineItem` deixará de executar limpezas globais antes de toda gravação. Salvamentos individuais escreverão somente o item solicitado.

Será adicionada uma operação em lote para atualizar metadados e prazos de vários capítulos dentro de uma única conexão e uma única transação. A limpeza de cache temporário continuará disponível, mas não fará parte do caminho crítico de abertura da página offline.

### Reconciliação Premium

A reconciliação continuará renovando licenças e downloads recuperáveis, porém:

- descobrirá itens recuperáveis por chaves e metadados leves;
- enviará até 100 IDs à rota existente;
- atualizará prazos de áudio e metadados em lote;
- não chamará `saveOfflineItem` repetidamente;
- será adiada na rota `/offline` até a primeira leitura do catálogo terminar;
- continuará limitada a uma execução por conta e janela de cinco minutos;
- falhas de rede também registrarão um intervalo de 60 segundos antes de nova tentativa para evitar repetição em toda navegação.

A publicação do shell ocorrerá depois da atualização local, sem bloquear a lista que já estiver renderizada.

### Service worker

Para uma conta autenticada, `/offline` usará stale-while-revalidate:

1. consultar o cache isolado da conta;
2. se houver resposta válida, devolvê-la imediatamente;
3. iniciar a busca de rede em segundo plano e publicar a nova resposta somente após as validações de conta existentes;
4. se não houver cache, aguardar a rede por no máximo quatro segundos;
5. depois do limite, retornar o fallback offline enquanto a requisição de rede termina em segundo plano.

O cache continuará isolado por conta. Uma resposta de outra conta nunca poderá ser exibida ou publicada.

## Interfaces

O módulo de cache produzirá operações com responsabilidades separadas:

- `getSavedOfflineItems(accountScope)`: snapshot leve, sem carregar blobs;
- `getRecoverableOfflineItems(accountScope)`: snapshot leve que inclui metadados expirados quando a chave de áudio ainda existe;
- `updateOfflineItemsBatch(accountScope, updates)`: atualiza prazo do áudio e metadados em uma transação;
- `removeOfflineItem(accountScope, chapterId)`: remove apenas metadado e áudio do capítulo indicado.

`reconcileOfflineEntitlement` consumirá uma única dependência de atualização local em lote, em vez de `extendAudioExpiry` e `saveItem` por capítulo.

## Concorrência

O carregamento do catálogo terá prioridade na rota `/offline`. Um coordenador por conta compartilhará a promessa da primeira leitura com a reconciliação. Fora dessa rota, a reconciliação poderá iniciar normalmente, mas suas gravações continuarão agrupadas.

Não serão disparadas várias transações `readwrite` concorrentes para o mesmo conjunto de capítulos.

## Erros e recuperação

- Falha ao abrir o IndexedDB: a lista exibe a mensagem existente de indisponibilidade local.
- Chave sem áudio legível: o item é removido quando selecionado e os demais continuam disponíveis.
- Metadado sem chave correspondente: o item não aparece e sua limpeza é agendada.
- Rede degradada: o shell em cache aparece imediatamente; a atualização falha silenciosamente e poderá ser tentada novamente depois de 60 segundos.
- Falha na renovação Premium: o catálogo vigente continua utilizável até o vencimento já assinado.
- Conta divergente: o service worker rejeita a publicação e mantém o cache correto anterior.

## Testes

Os testes serão escritos antes da implementação e demonstrarão:

- o snapshot consulta metadados e chaves uma única vez para 1, 20 e 100 capítulos;
- nenhum caminho de listagem lê `AudioRecord.data`;
- a lista não chama `hasValidEncryptedAudio` nem `saveOfflineItem` por capítulo;
- expirados e chaves ausentes são filtrados sem varredura de valores;
- remoções e renovações são agrupadas em uma transação;
- a reconciliação faz uma atualização local em lote;
- a reconciliação aguarda o primeiro snapshot na rota `/offline`;
- uma falha de rede recebe intervalo antes de nova tentativa;
- o service worker devolve o shell em cache mesmo quando a rede permanece pendente;
- sem cache, o fallback é devolvido depois de quatro segundos;
- uma resposta de outra conta não substitui o cache válido;
- ao tocar, somente o registro escolhido é lido e validado;
- suíte completa, lint e build de produção permanecem aprovados.

## Critérios de aceite

- A lista de capítulos não carrega nenhum `ArrayBuffer` de áudio.
- O número de operações do IndexedDB para listar capítulos permanece constante entre 1 e 100 itens.
- Um cache válido de `/offline` é entregue sem aguardar a rede.
- A reconciliação não cria uma operação de limpeza ou salvamento por capítulo.
- Downloads existentes continuam aparecendo e tocando sem novo download.
- Um capítulo inválido não bloqueia nem remove capítulos válidos.
- O isolamento por conta e a licença Premium continuam obrigatórios.

## Fora de escopo

- Alterar o formato criptográfico dos downloads existentes.
- Fragmentar áudios ou implementar reprodução progressiva.
- Migrar ou baixar novamente arquivos já salvos.
- Criar nova interface visual para gerenciamento de cache.
- Alterar regras de assinatura, limite de dispositivos ou autorização de conteúdo.
