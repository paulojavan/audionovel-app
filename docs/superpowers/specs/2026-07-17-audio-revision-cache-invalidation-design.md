# Revisão de áudio e invalidação do cache

## Objetivo

Garantir que uma correção de áudio feita no painel administrativo seja reproduzida na próxima sessão conectada, mesmo quando o usuário abriu o capítulo recentemente ou salvou o arquivo offline. Enquanto o dispositivo permanecer totalmente offline, a cópia anterior continua disponível porque não existe comunicação com o servidor para descobrir a nova revisão.

## Diagnóstico confirmado

O áudio online e offline é criptografado e salvo no IndexedDB com uma chave composta apenas por conta, modo e ID do capítulo. `getEncryptedAudioUrl` reutiliza esse registro sem comparar a origem ou uma versão da mídia. A rota pública do áudio também mantém o mesmo caminho depois de uma edição. Consequentemente, alterar `Chapter.audioUrl` não invalida o `AudioRecord` existente.

Usar `Chapter.updatedAt` como versão resolveria o sintoma, mas obrigaria novos downloads depois de qualquer mudança de título, transcrição ou metadado. Comparar somente a URL não detectaria a substituição do arquivo no mesmo endereço. Por isso, a versão será específica da mídia.

## Persistência e edição administrativa

`Chapter` recebe `audioRevision Int @default(1)`. Um script SQL para o Aiven adiciona a coluna não nula com valor padrão `1`; capítulos existentes começam na revisão `1`.

A rota de edição incrementa `audioRevision` quando:

- `contentType` muda;
- a URL de áudio normalizada muda; ou
- o administrador marca explicitamente que o arquivo foi substituído mantendo a mesma URL.

O formulário de edição oferece a opção `O arquivo de áudio foi substituído na mesma URL`. Ela aparece somente para capítulos em áudio, começa desmarcada e é enviada como um booleano validado pela API. Alterações apenas em título, capa, duração, transcrição, agrupamento ou acesso Premium não mudam a revisão.

A leitura do estado anterior, a comparação da mídia e a atualização do capítulo ocorrem na transação já usada pela rota. Criações começam na revisão `1` e não precisam de tratamento adicional.

## Contrato de versão

As superfícies que conhecem a mídia recebem `audioRevision` junto do ID do capítulo:

- a página do capítulo passa a revisão ao player;
- a URL lógica do player inclui a revisão como parâmetro, embora a rota continue buscando a URL privada no banco;
- `/api/offline/prepare` devolve `audioRevision` e uma URL de download versionada;
- `/api/offline/renew` devolve `audioRevision`, `cacheKey`, validade e a URL autorizada para baixar aquela revisão;
- `OfflineItem` e `AudioRecord` armazenam `audioRevision`.

O parâmetro de revisão não concede acesso nem escolhe a origem real. As rotas continuam autenticando, autorizando e consultando a revisão vigente no banco. A resposta de áudio permanece `private, no-store`.

## Cache online

`getEncryptedAudioUrl` recebe a revisão esperada. Um registro só pode ser reutilizado quando conta, capítulo, modo, validade e revisão forem compatíveis. Registro sem revisão, ou com revisão diferente, é tratado como cache miss.

O registro antigo não é apagado antes do novo download. O fluxo baixa, criptografa e grava a revisão nova sob a mesma chave somente depois do sucesso. Assim, uma falha de rede não destrói uma cópia offline ainda utilizável, mas o player conectado também não reproduz silenciosamente a versão antiga quando já conhece uma revisão nova.

O cache temporário e a referência de objeto mantida pelo player também consideram a URL lógica versionada. Uma navegação ou nova reprodução depois da edição deixa de reutilizar o objeto da revisão anterior.

## Cache offline e sincronização

Ao salvar um capítulo, o item local registra a revisão devolvida por `/api/offline/prepare`. `hasValidEncryptedAudio` também compara a revisão esperada, impedindo que o botão considere uma cópia antiga como pronta.

Na reconciliação Premium, `/api/offline/renew` informa a revisão atual de cada capítulo recuperável. Para itens com a mesma revisão, o fluxo apenas renova `cacheKey` e validade como hoje. Para itens com revisão diferente ou ausente, o fluxo:

1. baixa a URL autorizada da revisão atual;
2. criptografa e sobrescreve o `AudioRecord` somente após o download completo;
3. atualiza `OfflineItem` com a nova revisão, chave e validade;
4. publica a atualização do catálogo offline.

Se o download da correção falhar, o item e o registro anteriores permanecem intactos e a reconciliação poderá tentar novamente. Quando o dispositivo está totalmente offline, nenhuma comparação ocorre e a revisão anterior continua tocando. Na primeira sincronização bem-sucedida, registros legados sem `audioRevision` são substituídos automaticamente.

## Compatibilidade e armazenamento

O IndexedDB aceita o novo campo nos objetos existentes sem recriar os object stores. Portanto, a versão do banco local não precisa ser aumentada nem os blobs existentes precisam ser lidos em massa. A migração é gradual: cada registro legado é considerado desatualizado apenas quando um fluxo conectado conhece a revisão atual daquele capítulo.

O catálogo continua lendo apenas metadados e chaves durante a montagem. A verificação de revisão integra as operações direcionadas de download, reprodução e reconciliação, preservando as otimizações recentes da página offline.

## Erros e concorrência

- Falha ao consultar a revisão mantém o comportamento de erro da rota e não altera o cache local.
- Falha no download ou na criptografia preserva a cópia anterior.
- A revisão local só é atualizada depois que o novo áudio foi gravado.
- Downloads concorrentes do mesmo capítulo compartilham o coordenador existente da fila offline; a última gravação válida contém a revisão solicitada.
- Uma revisão fornecida pelo cliente nunca reduz nem altera `Chapter.audioRevision` no servidor.
- Alterações administrativas sem mudança de mídia não causam tráfego de áudio adicional.

## Testes

O desenvolvimento seguirá TDD e demonstrará:

- a migração e o schema definem `audioRevision` com padrão `1`;
- mudar URL, tipo de mídia ou marcar substituição na mesma URL incrementa a revisão;
- editar somente metadados preserva a revisão;
- player, preparação e renovação recebem a revisão vigente;
- registro de cache com a mesma revisão é reutilizado;
- registro legado ou com revisão diferente não é reutilizado;
- falha ao baixar a revisão nova preserva o registro anterior;
- sucesso sobrescreve o registro e os metadados com a nova revisão;
- renovação de revisão igual apenas estende a licença, sem baixar áudio;
- reconciliação de revisão diferente baixa e publica a nova cópia;
- fluxo totalmente offline ainda toca a cópia salva;
- listagem offline continua sem materializar blobs de áudio.

Ao final serão executados os testes direcionados, a suíte completa, o lint e o build de produção.

## Critérios de aceite

- Depois de uma troca de áudio, a próxima reprodução conectada usa a revisão nova.
- Um download offline é substituído automaticamente na primeira sincronização bem-sucedida.
- Uma falha durante a substituição não apaga a cópia offline anterior.
- Um dispositivo sem conexão continua reproduzindo o que já estava salvo.
- Editar metadados sem alterar a mídia não invalida o áudio.
- Substituir o arquivo mantendo a URL é suportado pela opção explícita do formulário administrativo.

## Fora de escopo

- Atualizar um dispositivo que permaneça sem qualquer conexão com o servidor.
- Alterar o formato AES-GCM ou fragmentar os arquivos de áudio.
- Fazer streaming progressivo a partir do IndexedDB.
- Exibir histórico de revisões de áudio ou permitir rollback no painel.
