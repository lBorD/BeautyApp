# Client Profile Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar uma tela mobile bonita e operacional para preparar o próximo atendimento da cliente, com edição, contato rápido, histórico paginado e avatar por iniciais durante o beta.

**Architecture:** A nova feature vive em `src/features/clients`, mantendo a lista legada como ponto de entrada e usando serviços Axios centralizados. O perfil recebe `initialClient` para primeiro paint, busca o DTO atual ao focar e compartilha um modal de edição interno. O avatar beta fica atrás de uma configuração de feature desativada e mostra um aviso ao toque, sem conhecer o storage futuro; a Agenda reaproveita seu formulário existente por uma solicitação de navegação consumida uma única vez.

**Tech Stack:** Expo SDK 53, React Native 0.79, React 19, React Navigation 7, Axios, React Native Paper, Jest Expo e React Native Testing Library.

## Global Constraints

- Tela única e contínua; sem abas no perfil.
- Próximos atendimentos e preferências aparecem antes dos dados cadastrais.
- Cancelados e arquivados nunca são buscados, filtrados ou exibidos pelo app.
- O avatar usa iniciais no beta; tocar nele mostra a mensagem aprovada e não inicia picker, permissão ou chamada de foto.
- Não instalar `expo-image`, `expo-image-picker` ou `expo-image-manipulator`, nem implementar upload/remoção nesta entrega.
- O app não assume PostgreSQL ou S3; a ativação futura consumirá o mesmo contrato HTTP por uma camada isolada.
- WhatsApp e ligação só habilitam para telefone brasileiro normalizado válido.
- Alvos de toque têm no mínimo 44 px e informação não depende somente de cor.
- Reaproveitar o formulário atual da Agenda; não duplicar regra de serviço, sinal, conflito ou Google Calendar.
- Não alterar `expo.version`/runtime nesta entrega; não executar build, OTA ou publicação.
- Preservar o stash `WIP BEAUTY-101 antes de BEAUTY-104`; não aplicar nem alterar esse stash.

---

### Task 1: Test harness e utilitários puros de contato/formatação

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/features/clients/utils/clientContactLinks.js`
- Create: `src/features/clients/utils/clientProfileFormatting.js`
- Test: `src/features/clients/utils/__tests__/clientContactLinks.test.js`
- Test: `src/features/clients/utils/__tests__/clientProfileFormatting.test.js`

**Interfaces:**
- Produces: `normalizeBrazilianPhone`, `buildPhoneUrl`, `buildWhatsAppUrl`.
- Produces: `getClientInitials`, `getClientDisplayName`, `mergeUniqueAppointments`.

- [ ] **Step 1: Instalar o test harness compatível com Expo 53/React 19**

Run:

```powershell
npx expo install jest-expo jest react-test-renderer -- --save-dev
npx expo install @testing-library/react-native -- --save-dev
```

Adicionar `"test": "jest"` e `"jest": { "preset": "jest-expo" }` ao `package.json`.

- [ ] **Step 2: Escrever testes falhando de telefone**

```js
it.each([
  ['(11) 99999-9999', '5511999999999'],
  ['+55 11 99999-9999', '5511999999999'],
])('normaliza %s', (input, expected) => {
  expect(normalizeBrazilianPhone(input)).toBe(expected);
});

it.each(['', '11999', '+1 202 555 0100'])('rejeita telefone incompleto ou fora do contrato: %s', (input) => {
  expect(normalizeBrazilianPhone(input)).toBeNull();
});

it('gera links oficiais sem caracteres de formatação', () => {
  expect(buildPhoneUrl('(11) 99999-9999')).toBe('tel:+5511999999999');
  expect(buildWhatsAppUrl('(11) 99999-9999')).toBe('https://wa.me/5511999999999');
});
```

- [ ] **Step 3: Confirmar RED**

Run: `npm test -- clientContactLinks --runInBand`  
Expected: FAIL porque o módulo não existe.

- [ ] **Step 4: Implementar utilitários mínimos e confirmar GREEN**

Aceitar somente 10/11 dígitos nacionais ou 12/13 dígitos iniciados por `55`; todos os demais retornam `null`.

Run: `npm test -- clientContactLinks --runInBand`  
Expected: PASS.

- [ ] **Step 5: Escrever RED/GREEN de formatação e deduplicação**

```js
expect(getClientInitials({ name: 'Ana', lastName: 'Silva' })).toBe('AS');
expect(getClientInitials({ name: 'Ana' })).toBe('A');
expect(mergeUniqueAppointments([{ id: 1 }], [{ id: 1 }, { id: 2 }])).toEqual([{ id: 1 }, { id: 2 }]);
```

Run antes/depois: `npm test -- clientProfileFormatting --runInBand`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/features/clients/utils
git commit -m "test: configura base do perfil da cliente"
```

### Task 2: Serviço HTTP do perfil

**Files:**
- Create: `src/features/clients/services/clientProfileAPI.js`
- Test: `src/features/clients/services/__tests__/clientProfileAPI.test.js`

**Interfaces:**
- Produces: `getClientProfile(clientId)`, `getClientHistory(clientId, cursor, limit = 10)`, `updateClientProfile(clientId, payload)` e `deleteClient(clientId)`.

- [ ] **Step 1: Escrever testes falhando do contrato HTTP**

```js
it('busca histórico com cursor e limite sem montar query manual', async () => {
  api.get.mockResolvedValue({ data: historyFixture });
  await expect(getClientHistory(12, 'opaque', 10)).resolves.toEqual(historyFixture);
  expect(api.get).toHaveBeenCalledWith('/clients/12/appointments/history', {
    params: { cursor: 'opaque', limit: 10 },
  });
});

it('atualiza somente o DTO operacional da cliente', async () => {
  api.patch.mockResolvedValue({ data: updatedClientFixture });
  await expect(updateClientProfile(12, { name: 'Ana', preferencesNotes: 'Prefere natural' }))
    .resolves.toEqual(updatedClientFixture);
  expect(api.patch).toHaveBeenCalledWith('/clients/update/12', {
    name: 'Ana', preferencesNotes: 'Prefere natural',
  });
});
```

- [ ] **Step 2: Confirmar RED**

Run: `npm test -- clientProfileAPI --runInBand`  
Expected: FAIL por serviço ausente.

- [ ] **Step 3: Implementar chamadas operacionais**

Usar `api.get`, `api.patch` e `api.delete` com parâmetros Axios. Não criar `FormData`, fonte autenticada ou chamada a `/photo`: o app beta ignora `photoUrl`/`photoUpdatedAt` até a ativação da feature.

- [ ] **Step 4: Confirmar GREEN**

Run: `npm test -- clientProfileAPI --runInBand`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/clients/services/clientProfileAPI.js src/features/clients/services/__tests__/clientProfileAPI.test.js
git commit -m "feat: adiciona contrato mobile do perfil"
```

### Task 3: Componentes visuais do perfil

**Files:**
- Create: `src/features/clients/components/ClientAvatar.jsx`
- Create: `src/features/clients/components/ClientAppointmentCard.jsx`
- Test: `src/features/clients/components/__tests__/ClientAvatar.test.jsx`
- Test: `src/features/clients/components/__tests__/ClientAppointmentCard.test.jsx`

**Interfaces:**
- Produces: `<ClientAvatar client size={96} onPress />`.
- Produces: `<ClientAppointmentCard appointment emphasized={false} />`.

- [ ] **Step 1: Escrever teste falhando do avatar**

```jsx
it('mostra iniciais e expõe a ação futura de foto', () => {
  render(<ClientAvatar client={{ name: 'Ana', lastName: 'Silva' }} onPress={jest.fn()} />);
  expect(screen.getByText('AS')).toBeTruthy();
  expect(screen.getByLabelText('Foto de Ana Silva')).toBeTruthy();
  expect(screen.getByRole('button')).toBeTruthy();
});
```

- [ ] **Step 2: Confirmar RED, implementar avatar e confirmar GREEN**

Run: `npm test -- ClientAvatar --runInBand`  
Expected antes: FAIL; depois: PASS.

Usar `Pressable` circular de 96 px, fundo `colors.primary`, texto branco e iniciais permanentes. Um pequeno indicador textual/ícone `Em breve` pode sinalizar a ação sem sugerir que o upload já funciona; não importar biblioteca de imagem.

- [ ] **Step 3: Escrever teste falhando do card**

```jsx
it('anuncia data, hora, serviços e status em texto', () => {
  render(<ClientAppointmentCard appointment={appointmentFixture} emphasized />);
  expect(screen.getByText(/Design de sobrancelhas/)).toBeTruthy();
  expect(screen.getByText(/Agendado/)).toBeTruthy();
  expect(screen.getByLabelText(/Design de sobrancelhas.*Agendado/)).toBeTruthy();
});
```

- [ ] **Step 4: Implementar card e confirmar GREEN**

Reutilizar linguagem da Agenda: card branco, raio 12, borda `colors.border`, horário/status no topo e serviços abaixo. Mapear `scheduled` para `Agendado` e `completed` para `Concluído`; não definir estilo de `canceled` porque o contrato nunca o envia.

Run: `npm test -- ClientAppointmentCard --runInBand`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/clients/components/ClientAvatar.jsx src/features/clients/components/ClientAppointmentCard.jsx src/features/clients/components/__tests__
git commit -m "feat: cria componentes do perfil da cliente"
```

### Task 4: Edição compartilhada dos dados e preferências

**Files:**
- Create: `src/features/clients/components/ClientEditModal.jsx`
- Create: `src/features/clients/utils/clientForm.js`
- Test: `src/features/clients/components/__tests__/ClientEditModal.test.jsx`
- Test: `src/features/clients/utils/__tests__/clientForm.test.js`

**Interfaces:**
- Produces: `buildClientFormState(client)` e `buildClientUpdatePayload(form)`.
- Produces: `<ClientEditModal visible client onClose onSaved onDeleted />`.

- [ ] **Step 1: Escrever testes falhando do payload**

```js
expect(buildClientUpdatePayload({
  name: ' Ana ', lastName: '', phone: '', email: '', birthDate: '', address: '', preferencesNotes: ' Natural ',
})).toEqual({
  name: 'Ana', lastName: '', phone: null, email: null, birthDate: null, address: '', preferencesNotes: 'Natural',
});
```

- [ ] **Step 2: Confirmar RED, implementar helper e confirmar GREEN**

Run: `npm test -- clientForm --runInBand`  
Expected antes: FAIL; depois: PASS.

- [ ] **Step 3: Escrever testes falhando do modal**

Cobrir: campos atuais preenchidos, opções cadastrais recolhidas quando vazias, contador/limite 2.000 de preferências, botão Salvar bloqueado durante request, `onSaved` com DTO atualizado e erro sem fechar.

Run: `npm test -- ClientEditModal --runInBand`  
Expected: FAIL por componente ausente.

- [ ] **Step 4: Implementar modal e confirmar GREEN**

Reaproveitar `formatPhoneNumber`, `formatBirthDay`, `formatDate`, `validateFormData`, `FeedbackModal` e o padrão visual atual. A exclusão mantém confirmação `Alert` e chama o endpoint existente; não altera a regra de exclusão nesta issue.

Run: `npm test -- ClientEditModal --runInBand`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/clients/components/ClientEditModal.jsx src/features/clients/utils/clientForm.js src/features/clients/components/__tests__/ClientEditModal.test.jsx src/features/clients/utils/__tests__/clientForm.test.js
git commit -m "feat: centraliza edição do perfil da cliente"
```

### Task 5: Tela operacional, estados e histórico progressivo

**Files:**
- Create: `src/features/clients/screens/ClientProfileScreen.jsx`
- Test: `src/features/clients/screens/__tests__/ClientProfileScreen.test.jsx`

**Interfaces:**
- Consumes: route `{ clientId, initialClient, openEdit? }`.
- Produces: callbacks de contato/agendamento e atualização local após editar.

- [ ] **Step 1: Escrever teste falhando do primeiro paint**

```jsx
it('mostra o cliente inicial enquanto carrega as seções remotas', () => {
  getClientProfile.mockReturnValue(new Promise(() => {}));
  renderProfile({ initialClient: { id: 12, name: 'Ana', phone: '(11) 99999-9999' } });
  expect(screen.getByText('Ana')).toBeTruthy();
  expect(screen.getByText('Carregando atendimentos…')).toBeTruthy();
});
```

- [ ] **Step 2: Escrever testes falhando de sucesso/vazios/erro**

Cobrir ordem das seções, primeiro próximo enfatizado, até quatro próximos, preferências, quatro históricos, campos cadastrais preenchidos, vazio com CTA, erro com `Tentar novamente` e cliente `404` com mensagem genérica.

- [ ] **Step 3: Confirmar RED**

Run: `npm test -- ClientProfileScreen --runInBand`  
Expected: FAIL por tela ausente.

- [ ] **Step 4: Implementar tela mínima e confirmar GREEN**

Usar `ScrollView` com `RefreshControl`, `useFocusEffect` para carga atual, estado anterior durante refresh e `initialClient` como fallback. Renderizar seções na ordem da especificação e somente dados cadastrais preenchidos.

Run: `npm test -- ClientProfileScreen --runInBand`  
Expected: PASS.

- [ ] **Step 5: Escrever RED/GREEN de paginação**

```jsx
it('concatena a próxima página sem repetir ids', async () => {
  getClientHistory.mockResolvedValue({ appointments: [{ id: 4 }, { id: 5 }], nextCursor: null });
  await user.press(screen.getByRole('button', { name: 'Carregar mais histórico' }));
  expect(screen.getAllByTestId('history-appointment')).toHaveLength(5);
});
```

Desabilitar botão enquanto carrega e usar `mergeUniqueAppointments`.

- [ ] **Step 6: Commit**

```bash
git add src/features/clients/screens/ClientProfileScreen.jsx src/features/clients/screens/__tests__/ClientProfileScreen.test.jsx
git commit -m "feat: implementa perfil operacional da cliente"
```

### Task 6: Entrada pela lista e agendamento pré-selecionado

**Files:**
- Modify: `src/navigation/AppNavigator.jsx`
- Modify: `src/screens/clients/cliente.jsx`
- Modify: `src/screens/calendar/AgendaScreen.jsx`
- Create: `src/screens/calendar/scheduleRequest.js`
- Test: `src/screens/calendar/__tests__/scheduleRequest.test.js`
- Test: `src/features/clients/screens/__tests__/ClientProfileScreen.test.jsx`

**Interfaces:**
- Produces: rota Stack `ClientProfile`.
- Produces: `buildScheduleRequest(client, now)` e `getScheduleRequestClient(request, lastHandledId)`.

- [ ] **Step 1: Escrever testes falhando da solicitação única**

```js
const request = buildScheduleRequest({ id: 12, name: 'Ana', lastName: 'Silva' }, 1234);
expect(request).toEqual({ requestId: '12-1234', client: { id: 12, name: 'Ana', lastName: 'Silva' } });
expect(getScheduleRequestClient(request, null)).toEqual(request.client);
expect(getScheduleRequestClient(request, request.requestId)).toBeNull();
```

- [ ] **Step 2: Confirmar RED, implementar helper e confirmar GREEN**

Run: `npm test -- scheduleRequest --runInBand`  
Expected antes: FAIL; depois: PASS.

- [ ] **Step 3: Escrever teste falhando da ação Agendar**

No teste da tela, pressionar `Agendar` e verificar:

```js
expect(navigation.navigate).toHaveBeenCalledWith('Main', {
  screen: 'Agenda',
  params: { scheduleRequest: expect.objectContaining({ client: expect.objectContaining({ id: 12 }) }) },
});
```

- [ ] **Step 4: Implementar navegação/lista**

Registrar `ClientProfile` sem header nativo. Card inteiro abre com `{ clientId, initialClient }`; lápis abre com `openEdit: true`. Remover o modal/estado de edição duplicado de `cliente.jsx`, manter exclusão dentro de `ClientEditModal` e atualizar lista com `useFocusEffect` ao voltar.

- [ ] **Step 5: Integrar Agenda sem duplicar formulário**

Alterar assinatura para `AgendaScreen({ route })`; `openCreateModal(prefilledClient = null)` preserva cliente em `selectedClientOption`, `clients` e `form.clientId`. Um `lastScheduleRequestIdRef` consome somente ids novos, chama `openCreateModal` e limpa `scheduleRequest` com `navigation.setParams({ scheduleRequest: undefined })`.

- [ ] **Step 6: Confirmar testes e parse**

Run: `npm test -- scheduleRequest ClientProfileScreen --runInBand`  
Expected: PASS.  
Run: `node -e "require('@babel/core').transformFileSync('src/screens/calendar/AgendaScreen.jsx')"`  
Expected: exit 0 sem arquivo persistente.

- [ ] **Step 7: Commit**

```bash
git add src/navigation/AppNavigator.jsx src/screens/clients/cliente.jsx src/screens/calendar/AgendaScreen.jsx src/screens/calendar/scheduleRequest.js src/screens/calendar/__tests__/scheduleRequest.test.js src/features/clients/screens/__tests__/ClientProfileScreen.test.jsx
git commit -m "feat: conecta perfil à lista e à agenda"
```

### Task 7: Guard de ativação da foto durante o beta

**Files:**
- Create: `src/features/clients/config/clientPhotoFeature.js`
- Modify: `src/features/clients/screens/ClientProfileScreen.jsx`
- Test: `src/features/clients/screens/__tests__/ClientProfileScreen.test.jsx`

**Interfaces:**
- Produces: `CLIENT_PHOTO_ENABLED = false` e `CLIENT_PHOTO_BETA_MESSAGE`.

- [ ] **Step 1: Escrever teste falhando do aviso beta**

```jsx
it('explica a indisponibilidade da foto sem iniciar integração nativa ou HTTP', async () => {
  renderProfile();
  await user.press(screen.getByLabelText('Foto de Ana Silva'));
  expect(Alert.alert).toHaveBeenCalledWith(
    'Foto em breve',
    'Este app ainda está na versão beta. A funcionalidade de imagem será ativada quando o app estiver pronto para lançamento.',
  );
});
```

- [ ] **Step 2: Confirmar RED e criar a configuração explícita**

Centralizar a flag e a mensagem aprovada em `clientPhotoFeature.js`. A tela não deve interpretar `photoUrl`, criar `FormData`, pedir permissão ou importar módulos de imagem quando a flag estiver `false`.

Run antes/depois: `npm test -- ClientProfileScreen --runInBand`.

- [ ] **Step 3: Verificar ausência de integração nativa acidental**

Run:

```powershell
rg "expo-image|expo-image-picker|expo-image-manipulator|launchImageLibrary|FormData|/photo" src package.json app.json
```

Expected: nenhuma implementação de foto adicionada pela feature; referências não relacionadas/preexistentes devem ser avaliadas e registradas, não removidas mecanicamente.

- [ ] **Step 4: Commit**

```bash
git add src/features/clients/config/clientPhotoFeature.js src/features/clients/screens/ClientProfileScreen.jsx src/features/clients/screens/__tests__/ClientProfileScreen.test.jsx
git commit -m "feat: sinaliza foto como recurso beta"
```

### Task 8: Versões, documentação e verificação mobile

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `CHANGELOG.md`
- Modify: `APP_GUIDELINES.md`

**Interfaces:**
- Produces: versão visível `1.4.0`; `expo.version`/runtime/binário permanecem inalterados.

- [ ] **Step 1: Atualizar versões e documentação**

Registrar tela, preferências internas, histórico, criação rápida, aviso beta da foto e fronteira de storage preparada para S3 futuro. Documentar que não há picker/permissão/módulo nativo nem necessidade de nova build por essa feature. Não executar `eas build`, `eas update` ou comandos Apple.

- [ ] **Step 2: Executar testes mobile completos**

Run: `npm test -- --runInBand`  
Expected: todas as suítes PASS sem handles abertos.

- [ ] **Step 3: Verificar compatibilidade Expo**

Run: `npx expo install --check`  
Expected: nenhuma incompatibilidade nova causada pela feature; registrar os quatro desvios preexistentes do baseline.  
Run: `npx expo-doctor`  
Expected: o mesmo baseline de 16/17 ou melhor, sem novo erro da feature.

- [ ] **Step 4: Validar configuração e bundle**

Run: `npx expo config --type public`  
Expected: configuração inalterada pela foto beta, plugins válidos e nenhum segredo.
Run: `npx expo export --platform ios --output-dir .expo-profile-check`  
Expected: bundle concluído; remover somente `.expo-profile-check` após validar o caminho absoluto dentro do repo.

- [ ] **Step 5: Verificação estática e estado Git**

Run: `git diff --check`  
Expected: nenhuma saída.  
Run: `git status --short`  
Expected: somente arquivos da BEAUTY-104 antes do commit.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json CHANGELOG.md APP_GUIDELINES.md
git commit -m "docs: registra perfil operacional da cliente"
```
