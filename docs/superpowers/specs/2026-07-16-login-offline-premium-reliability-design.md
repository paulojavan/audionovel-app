# Login e Premium Offline Confiáveis

## Objetivo

Reformular a identificação de dispositivos e a autorização offline para que:

- o mesmo aparelho consiga entrar novamente sem ser tratado como um dispositivo novo por causa de uma falha de armazenamento local;
- cada conta tenha até três dispositivos ativos;
- o quarto dispositivo substitua automaticamente somente o dispositivo ativo há mais tempo;
- downloads offline permaneçam autorizados até o vencimento real da assinatura Premium;
- a interface nunca informe que o Premium venceu enquanto a assinatura exibida ainda estiver ativa;
- downloads afetados pela antiga validade de 24 horas sejam recuperados sem novo download quando o áudio criptografado ainda existir.

Esta especificação substitui, para o limite e a reação ao excesso de dispositivos, as regras do documento `2026-06-18-jwt-device-auth-design.md`.

## Diagnóstico

### Login

O identificador atual do dispositivo existe somente em `localStorage`. Esse armazenamento pode estar indisponível, ser limpo ou variar entre o navegador e o PWA instalado. Quando isso acontece, o mesmo aparelho gera outro identificador e pode ser contado como um novo dispositivo.

O limite atual é de dois dispositivos. Um terceiro identificador revoga todas as sessões e rejeita a tentativa, obrigando o usuário legítimo a entrar novamente. Essa reação amplia uma falha local de identificação para uma interrupção em todos os aparelhos.

### Premium offline

A tela apresentada pelo usuário demonstra estados contraditórios: o cabeçalho mostra 30 dias de Premium, enquanto o gate offline mostra “Seu Premium venceu”. A causa é o teto fixo de 24 horas aplicado por `getOfflineLicenseExpiry`, independentemente do vencimento real da assinatura.

O mesmo teto também é gravado em `OfflineDownload`, nos metadados locais e no registro criptografado do áudio. Portanto, corrigir apenas a mensagem ou a licença assinada não basta: todos esses prazos precisam usar a mesma fonte de verdade.

## Abordagens consideradas

### Correção pontual

Aumentar o limite para três, trocar a revogação total pela substituição do mais antigo e remover o teto de 24 horas. Tem menor custo, mas continua dependendo exclusivamente de `localStorage` e deixa sessão, shell offline e licença fracamente coordenados.

### Estado durável e reconciliado — escolhida

Usar uma identidade de dispositivo assinada pelo servidor, preservada em cookie próprio e espelhada no armazenamento local quando disponível. Separar a licença offline da sessão efêmera e vinculá-la à conta e ao dispositivo estável. Reconciliar licença, metadados e shell sempre que uma conta Premium voltar à internet.

Essa abordagem resolve as duas causas raiz sem remover o controle de compartilhamento.

### Autorização apenas por conta

Remover o vínculo com dispositivo e controlar somente a conta. É simples, mas enfraquece o limite solicitado e permite reutilização mais fácil do estado offline em instalações copiadas.

## Arquitetura

### Identidade estável do dispositivo

O navegador usará um token opaco e assinado de dispositivo, com identificador aleatório e versão. O token não conterá dados pessoais nem dependerá de impressão digital do navegador.

Antes de chamar o login por credenciais, o cliente garantirá a existência desse token por uma rota de mesma origem. A rota seguirá esta ordem:

1. validar o token presente no cookie de dispositivo;
2. se o cookie estiver ausente, aceitar uma cópia local somente quando sua assinatura for válida;
3. se nenhuma cópia válida existir, emitir um token novo;
4. devolver a cópia que pode ser espelhada localmente sem expor segredos do servidor.

O cookie terá `Secure` em produção, `SameSite=Lax` e caminho `/`. O token é identificador, não credencial de autenticação: copiar ou alterar seu valor não concede acesso sem e-mail e senha válidos. A assinatura impede a invenção de identificadores escolhidos pelo cliente.

Falhas de `localStorage` serão capturadas e não poderão impedir o envio do login. Se cookie e cópia local forem apagados, o aparelho poderá receber uma identidade nova; nesse caso, a substituição automática impede bloqueio da conta.

### Política de três dispositivos

Um dispositivo ativo continua definido como um `deviceIdHash` distinto com sessão não revogada e não expirada.

Ao entrar:

1. credenciais e bloqueio da conta são validados;
2. sessões expiradas são ignoradas;
3. se o dispositivo já estiver ativo, somente as sessões anteriores desse dispositivo são revogadas e uma sessão nova é criada;
4. se for novo e houver menos de três dispositivos, a sessão é criada normalmente;
5. se for novo e já houver três, o dispositivo com `lastSeenAt` mais antigo é revogado e a nova sessão é criada na mesma operação lógica;
6. os outros dois dispositivos permanecem ativos.

Empates em `lastSeenAt` serão resolvidos por `createdAt` e depois por `id`, produzindo resultado determinístico. A substituição criará um evento de segurança informativo, sem bloquear a conta e sem exibir uma etapa adicional ao usuário.

Erros de banco durante a substituição não podem deixar quatro dispositivos ativos nem revogar o mais antigo sem criar a nova sessão. A operação usará transação.

### Licença offline v2

A licença assinada v2 conterá:

- versão;
- ID da conta;
- hash ou identificador estável do dispositivo;
- instante de emissão;
- vencimento real do Premium.

Ela não conterá `sessionId`. Entrar novamente no mesmo aparelho gira a sessão online, mas não invalida conteúdo offline legítimo. A assinatura Ed25519 existente continuará protegendo o payload contra alteração.

Para usuários comuns, `expiresAt` será exatamente o menor valor entre o vencimento real do Premium e qualquer vencimento de acesso específico do conteúdo, se houver. Não existirá teto artificial de 24 horas. Administradores sem assinatura manterão a validade técnica atual de 24 horas; essa exceção não será apresentada como assinatura Premium.

Licenças v1 continuarão verificáveis apenas durante sua validade original. Quando houver internet, serão substituídas por v2 antes da atualização do shell offline.

### Fonte única de vencimento

O vencimento autorizado pelo servidor será aplicado conjuntamente a:

- licença offline assinada;
- `OfflineDownload.expiresAt`;
- metadado do item no IndexedDB;
- registro criptografado do áudio;
- shell `/offline` publicado no cache da conta.

Uma função de domínio produzirá esse vencimento. Componentes e rotas não calcularão prazos independentes.

### Reconciliação online e recuperação

Quando uma conta Premium estiver online, um coordenador cliente executará uma reconciliação única por janela de tempo e por conta:

1. lê os IDs de capítulos offline existentes sem apagar registros apenas porque o prazo antigo passou;
2. envia no máximo 100 IDs para uma rota de renovação;
3. o servidor confirma Premium ativo e revalida o acesso a cada capítulo;
4. para itens autorizados, o servidor renova ou recria `OfflineDownload` e devolve chave e vencimento;
5. o cliente atualiza os metadados e prolonga o registro criptografado existente sem baixar o áudio novamente;
6. por último, solicita ao service worker uma nova publicação de `/offline` com a licença v2.

Itens sem arquivo criptografado, removidos do catálogo ou sem permissão não serão renovados. Se o áudio já tiver sido fisicamente apagado pela limpeza anterior, o usuário precisará baixá-lo novamente.

A preparação do shell aguardará a confirmação de `SET_ACCOUNT_SCOPE`; não dependerá de duas mensagens concorrentes sem reconhecimento.

## Fluxos do usuário

### Login conhecido

1. A página garante o token de dispositivo.
2. O usuário envia e-mail e senha.
3. O servidor reconhece o hash já ativo.
4. A sessão anterior desse aparelho é girada.
5. O usuário entra em uma única tentativa.

### Quarto dispositivo

1. O usuário envia credenciais válidas.
2. O servidor encontra três dispositivos ativos diferentes.
3. Em transação, revoga o menos recente e cria a sessão atual.
4. O login conclui normalmente.
5. Apenas o aparelho substituído perde acesso na próxima validação.

### Uso offline

1. Online, a conta Premium recebe uma licença v2 até o vencimento real.
2. Áudio, item local, linha do banco e shell recebem o mesmo prazo.
3. Sem rede, o gate valida assinatura, conta, dispositivo e relógio.
4. Enquanto `now < expiresAt`, os capítulos permanecem disponíveis.
5. No vencimento real, o gate bloqueia e informa que a assinatura venceu.

### Recuperação de conteúdo antigo

1. O usuário afetado volta à internet com Premium ativo.
2. A reconciliação encontra o registro criptografado antigo ainda presente.
3. O servidor reautoriza o capítulo e emite o novo prazo.
4. O cliente atualiza o registro e o shell sem transferir o áudio novamente.

## Estados e mensagens

O gate deixará de tratar toda falha como vencimento:

- assinatura realmente vencida: “Seu Premium venceu”.
- licença ausente ou antiga com internet: “Atualizando seu acesso offline…”.
- licença inválida sem internet: “Não foi possível validar o acesso offline. Conecte-se à internet para atualizar.”
- relógio do aparelho incompatível: manter aviso específico de data e hora.
- nenhum conteúdo recuperável: informar que é necessário salvar o capítulo novamente.

O cabeçalho e o gate usarão a mesma data de assinatura. Não será possível renderizar simultaneamente “30 dias de Premium” e “Seu Premium venceu” a partir do mesmo estado válido.

No login, falhas ao preparar a identidade do dispositivo terão mensagem de tentativa novamente, distinta de credenciais inválidas. Excesso de dispositivos não será exibido como erro porque a substituição é automática.

## Segurança

- E-mail e senha continuam obrigatórios; token de dispositivo não autentica a conta.
- O servidor nunca confiará em um identificador de dispositivo sem assinatura válida.
- Identificadores persistidos no banco continuam armazenados como hash.
- Caches, chaves e metadados offline permanecem isolados por conta.
- A licença v2 é vinculada ao dispositivo estável e não pode ser movida para outro identificador sem falhar na verificação.
- Logout atualiza o escopo do service worker para anônimo; logout global revoga sessões online, mas não pode retroativamente contatar um aparelho que já esteja sem rede. O limite da autorização offline será o vencimento já assinado.
- A renovação em lote terá limite de 100 capítulos, rate limit e validação individual de acesso.

## Testes

Os testes serão escritos antes da implementação e deverão demonstrar:

### Dispositivo e login

- token válido no cookie é reutilizado;
- cópia local válida restaura um cookie ausente;
- armazenamento local indisponível não impede o login;
- mesmo dispositivo gira somente sua própria sessão;
- primeiro, segundo e terceiro dispositivos são aceitos;
- quarto dispositivo substitui somente o de `lastSeenAt` mais antigo;
- empate usa a ordem determinística definida;
- falha transacional não deixa estado parcial;
- sessões dos outros dois dispositivos continuam válidas.

### Premium offline

- assinatura com 30 dias gera licença e download com 30 dias, não 24 horas;
- licença v2 permanece válida após 24 horas e antes do vencimento real;
- licença v2 não depende do `sessionId` girado no login;
- conta, dispositivo, assinatura, relógio ou payload incompatíveis são rejeitados com estados distintos;
- reconciliação prolonga áudio criptografado existente sem baixá-lo novamente;
- conteúdo ausente ou não autorizado não é renovado;
- shell só é publicado depois de escopo, licença e metadados estarem sincronizados;
- a interface não mostra vencimento quando o Premium do mesmo estado está ativo;
- licença v1 válida é aceita e substituída online por v2.

### Verificação global

- suíte completa;
- lint;
- build de produção;
- teste manual em navegador e PWA instalado: mesmo aparelho, quarto aparelho, mais de 24 horas simuladas, ausência de rede e recuperação de item antigo.

## Critérios de aceite

- Uma conta entra novamente no mesmo navegador ou PWA sem falso excesso de dispositivos quando ao menos uma cópia válida da identidade permanece.
- Uma conta usa até três dispositivos simultâneos.
- O quarto login válido substitui automaticamente apenas o dispositivo menos recente.
- Um Premium com 30 dias restantes continua ouvindo offline depois de 24 horas.
- A mensagem “Seu Premium venceu” aparece somente quando a data real da assinatura tiver passado.
- Voltar à internet renova licença, metadados e shell de forma coordenada.
- Um áudio afetado pelo prazo antigo é recuperado sem novo download quando o blob criptografado ainda existir.
- Nenhum conteúdo privado atravessa contas ou dispositivos.

## Fora de escopo

- Tela de gerenciamento manual de dispositivos.
- Confirmação antes de substituir o dispositivo mais antigo.
- Impressão digital invasiva do aparelho.
- Revogação instantânea de conteúdo em um dispositivo já desconectado.
- Alteração do provedor de pagamentos ou da regra que calcula o vencimento da assinatura.
