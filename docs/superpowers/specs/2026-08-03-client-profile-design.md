# Perfil operacional da cliente — especificação de design

**Issues:** `lBorD/BeautyApp#104` e `lBorD/api#41`  
**Data:** 2026-08-03  
**Estado:** direção aprovada pelo usuário para implementação; foto desativada durante o beta

## Objetivo

Criar um perfil de cliente que ajude a profissional a se preparar rapidamente para o próximo atendimento. A tela deve abrir com contexto útil, exigir poucos toques e manter dados cadastrais como informação secundária.

O perfil deve continuar útil quando não houver foto, telefone, observações ou atendimentos. Atendimentos cancelados e arquivados permanecem no banco, mas não aparecem nem trafegam nesse fluxo.

## Princípios de produto

- uma tela contínua, sem abas no MVP;
- próximo atendimento e contexto da cliente acima da ficha cadastral;
- dados progressivos: mostrar somente campos preenchidos;
- uma ação principal clara: `Agendar atendimento`;
- avatar por iniciais durante o beta, com a futura foto isolada atrás de um contrato de feature;
- preferências permanentes separadas das observações de cada agendamento;
- sem métricas financeiras, fidelidade, prontuário, galeria ou CRM amplo.

## Experiência mobile

### Entrada e navegação

- tocar em qualquer card da lista de Clientes abre `ClientProfile`;
- o lápis da lista e o comando `Editar` do perfil abrem `EditClient`;
- `ClientProfile` e `EditClient` ficam no Stack principal, fora das abas;
- voltar preserva a aba Clientes;
- `Agendar` navega para a aba Agenda e abre o formulário de novo agendamento com a cliente pré-selecionada;
- o parâmetro de criação rápida contém um `requestId` único para que a Agenda consuma cada solicitação somente uma vez.

### Hierarquia da tela

1. Barra superior com voltar e `Editar`.
2. Cabeçalho com avatar circular de 96 px por iniciais, nome completo, telefone quando houver e indicação discreta de que a foto chegará depois do beta.
3. Ações rápidas com área mínima de toque de 44 px:
   - `Agendar` sempre disponível;
   - `WhatsApp` e `Ligar` disponíveis somente quando houver telefone válido;
   - ações indisponíveis permanecem visíveis com estado desabilitado e descrição acessível.
4. `Próximos atendimentos`:
   - primeiro atendimento com maior destaque;
   - até três seguintes em cards compactos;
   - cada card mostra data, hora, serviços e status textual;
   - vazio oferece `Agendar atendimento`.
5. `Preferências e observações`:
   - texto interno e opcional, limitado a 2.000 caracteres;
   - vazio explica exemplos de uso sem sugerir dados clínicos sensíveis;
   - edição ocorre em `EditClient`.
6. `Histórico`:
   - quatro itens recentes na carga inicial;
   - `Carregar mais` busca páginas de dez itens por cursor;
   - ordem decrescente por `startAt` e `id`;
   - cada item mostra data, hora, serviços, status e observação daquele atendimento quando existir;
   - cancelados e arquivados nunca entram.
7. `Dados da cliente`:
   - telefone, e-mail, nascimento, endereço e data de cadastro;
   - campos vazios não ocupam linhas.

### Estados e comportamento

- o card selecionado fornece `initialClient`, permitindo renderizar nome e contato antes da rede;
- se a busca estiver em andamento, somente as seções remotas mostram carregamento; não há spinner de tela inteira;
- pull-to-refresh atualiza cliente e atendimentos;
- erro com dados iniciais mantém o cabeçalho utilizável e mostra tentativa novamente nas seções;
- erro sem qualquer dado mostra estado de erro com `Tentar novamente`;
- falha ao abrir WhatsApp ou telefone gera feedback legível;
- a tela respeita fonte dinâmica, leitor de tela e redução de movimento; nenhuma informação depende apenas de cor.

### Avatar e foto durante o beta

- o avatar mostra sempre as iniciais da cliente nesta entrega;
- tocar no avatar ou na indicação de foto mostra exatamente: `Este app ainda está na versão beta. A funcionalidade de imagem será ativada quando o app estiver pronto para lançamento.`;
- o app beta não abre biblioteca ou câmera, não pede permissão, não envia nem remove foto e não chama as rotas de imagem;
- `expo-image`, `expo-image-picker` e `expo-image-manipulator` não entram nesta entrega, evitando alteração nativa e nova build somente por esse recurso;
- o componente visual e o serviço permanecem desacoplados do mecanismo de armazenamento, para que uma tarefa futura aceite uma fonte remota sem redesenhar o perfil;
- a ativação futura terá tarefa própria, incluindo experiência, permissões, adaptador S3-compatible, testes e versionamento nativo.

## Contrato da API

Todas as rotas exigem JWT e filtram simultaneamente por `clientId` e `req.user.id`. Cliente inexistente ou pertencente a outra conta recebe `404` com a mesma resposta.

### `GET /clients/:id/profile`

Resposta inicial enxuta:

```json
{
  "client": {
    "id": 12,
    "name": "Ana",
    "lastName": "Silva",
    "phone": "+5511999999999",
    "email": null,
    "address": null,
    "birthDate": null,
    "preferencesNotes": "Prefere acabamento natural.",
    "photoUrl": "/clients/12/photo?v=2026-08-03T12%3A00%3A00.000Z",
    "photoUpdatedAt": "2026-08-03T12:00:00.000Z",
    "createdAt": "2026-01-10T12:00:00.000Z",
    "updatedAt": "2026-08-03T12:00:00.000Z"
  },
  "upcomingAppointments": [],
  "history": {
    "appointments": [],
    "nextCursor": null
  }
}
```

Regras:

- no máximo quatro próximos, ordenados por `startAt ASC, id ASC`;
- no máximo quatro históricos, ordenados por `startAt DESC, id DESC`;
- próximos usam `startAt >= now`;
- histórico usa `startAt < now`, inclusive agendamentos antigos ainda marcados como `scheduled`;
- ambos exigem `archivedAt IS NULL` e `status <> canceled`;
- appointments retornam apenas `id`, `clientId`, `startAt`, `endAt`, `serviceIds`, `services`, `serviceName`, `status` e `notes`;
- bytes da foto nunca saem dentro do JSON.

### `GET /clients/:id/appointments/history?limit=10&cursor=<cursor>`

- `limit` padrão 10, mínimo 1 e máximo 20;
- cursor opaco Base64URL contém `startAt` e `id` do último item;
- busca registros anteriores ao par do cursor;
- resposta: `{ "appointments": [], "nextCursor": null }`;
- cursor inválido responde `400`;
- ordenação determinística evita repetição ou salto quando horários coincidem.

### Atualização da cliente

`POST /clients/register` e `PATCH /clients/update/:id` passam a aceitar `preferencesNotes` opcional. O middleware normaliza espaço externo, converte vazio em `null` e rejeita mais de 2.000 caracteres. Listagens e sincronização de clientes não retornam `preferencesNotes`; esse campo pertence ao perfil.

### Foto autenticada

1. `PUT /clients/:id/photo` recebe `multipart/form-data` com um único campo `photo`.
2. A API confirma a cliente por `{ id, userId }` antes de processar o arquivo.
3. O middleware mantém no máximo 5 MiB em memória e rejeita campos ou arquivos extras.
4. O processador não confia no MIME declarado: decodifica somente JPEG, PNG ou WebP, limita a entrada a 16 megapixels, aplica orientação, recorta para 512 × 512 e reencoda WebP com qualidade 80 sem EXIF/GPS.
5. A saída final deve ter no máximo 512 KiB. A persistência valida a propriedade e substitui a foto em transação com lock; qualquer falha antes do commit preserva a foto anterior.
6. `GET /clients/:id/photo` exige JWT e consulta simultaneamente `clientId` e `userId`. Responde WebP com `ETag`, `Cache-Control: private, max-age=86400, must-revalidate` e `X-Content-Type-Options: nosniff`; `If-None-Match` correspondente responde `304` sem corpo.
7. `DELETE /clients/:id/photo` exige a mesma propriedade e é idempotente, respondendo `204` quando a cliente não possui foto.

O app beta não consome essas rotas. Na ativação futura, o cliente enviará `FormData`, nunca Base64, e consumirá `photoUrl` sem conhecer se o adaptador usa PostgreSQL ou S3. O parâmetro `v=photoUpdatedAt` continuará invalidando a imagem após substituição.

### Banco e desempenho

A migration adiciona em `Clients`:

- `preferencesNotes TEXT NULL`;

e cria `client_photos`, separando o binário do cadastro quente:

- `id INTEGER PK`;
- `userId INTEGER NOT NULL`, FK para `users`;
- `clientId INTEGER NOT NULL UNIQUE`, FK para `Clients` com `ON DELETE CASCADE`;
- `data BYTEA NOT NULL`;
- `mimeType STRING NOT NULL`, sempre `image/webp`;
- `byteSize INTEGER NOT NULL`;
- `checksum STRING(64) NOT NULL`, SHA-256;
- `width INTEGER NOT NULL` e `height INTEGER NOT NULL`;
- timestamps.

A mesma entrega adiciona índices `client_photos(userId, clientId)` e `appointments(userId, clientId, startAt, id)`. A consulta inicial usa três operações pequenas em paralelo depois de confirmar a cliente: metadados da foto, próximos e histórico recente. O conteúdo binário só é lido quando o componente solicita a rota. Não há cache HTTP do JSON de perfil nesta issue; a futura política de cache continua em `lBorD/api#40`.

## Decisão de armazenamento

O projeto não possui bucket, IAM, secrets ou lifecycle provisionados. A API fica tecnicamente preparada e testada com PostgreSQL `BYTEA` em tabela separada e saída rigidamente normalizada, mas a UI beta não ativa nem chama a funcionalidade.

Esse desenho é limitado a um avatar pequeno por cliente. Não serve para originais, galeria ou fotos de procedimentos. Toda leitura e gravação passa por `clientPhotoStorage`; trocar o adaptador por um bucket privado S3-compatible não muda controllers, DTOs ou rotas. `multer` e `sharp` ficam fixados em versões compatíveis com Node 18.20.6; bucket, IAM, secrets, lifecycle e ativação mobile pertencem a uma tarefa futura.

## Segurança e privacidade

- toda query contém `userId`; não basta validar apenas a cliente na primeira chamada;
- notas são internas e nunca entram em compartilhamento/WhatsApp;
- não guardar documentos, cartão, informação clínica detalhada ou fotos de procedimentos no campo genérico;
- nomes de arquivo fornecidos pelo dispositivo não são persistidos;
- MIME, conteúdo real, dimensões e tamanho são validados no backend; a validação mobile será adicionada somente quando a foto for ativada;
- bytes só saem por rota autenticada e com cache privado;
- nenhum token ou conteúdo binário aparece em logs, respostas de erro ou listagens;
- ações de foto são idempotentes do ponto de vista do perfil: falha antes da conclusão mantém a foto anterior.

## Testes e validação

### API automatizada

- acesso autorizado e isolamento entre usuários;
- perfil ausente/estrangeiro como `404`;
- próximos e histórico ordenados e limitados;
- exclusão de `canceled` e `archivedAt` em todas as queries;
- cursor válido, inválido, limite mínimo/máximo e empate de horário;
- normalização e limite de `preferencesNotes`;
- upload, leitura, `304`, substituição e remoção de foto;
- rejeição de MIME declarado falso, imagem corrompida, excesso de pixels, entrada maior que 5 MiB e saída maior que 512 KiB;
- falha de processamento ou banco preserva a foto anterior;
- regressão completa das 18 suítes existentes.

### Mobile automatizado

- helpers de iniciais, telefone/WhatsApp, datas e payload de edição;
- serviço HTTP usa rotas e parâmetros corretos;
- tela mostra fallback por iniciais, próximo atendimento, observações, histórico e estados vazios;
- ações sem telefone ficam desabilitadas;
- `Carregar mais` concatena sem duplicar;
- criação rápida envia cliente e `requestId` à Agenda;
- toque no avatar mostra a mensagem beta exata e não chama picker, permissão ou endpoint de foto.

### Validação manual

- iOS e Android: abrir perfil pela lista, voltar, editar e atualizar;
- tocar no avatar e confirmar a mensagem beta exata, sem diálogo de permissão ou requisição de foto;
- testar WhatsApp instalado/não instalado e ligação;
- testar cliente sem telefone, foto, observações ou histórico;
- confirmar que cancelados nunca aparecem nem são requisitados;
- confirmar leitor de tela, texto ampliado e áreas de toque;
- confirmar que a entrega não adicionou módulo nativo nem alterou o runtime/binário por causa da foto.

## Entrega e versionamento

- app na branch `feat/BEAUTY-104`;
- API na branch `feat/BEAUTY-41`;
- versão visível do app sobe de `1.3.2` para `1.4.0`;
- `expo.version` e `runtimeVersion` não mudam, pois a foto beta não adiciona dependência nativa;
- versão da API sobe de `1.2.0` para `1.3.0`;
- PRs seguem para `develop` e permanecem em `In review` até validação manual;
- não executar migration de produção, deploy da API, EAS Update ou build sem autorização específica.

## Fora do escopo

- recebimento de contato compartilhado do WhatsApp (`BeautyApp#105`);
- mesclagem automática de clientes;
- exclusão lógica de cliente;
- câmera, galeria antes/depois ou anexos;
- alergias, prontuário e formulários clínicos;
- estatísticas de gasto, retenção e frequência;
- lembretes, marketing, fidelidade ou pagamentos;
- cache server-side do perfil.
