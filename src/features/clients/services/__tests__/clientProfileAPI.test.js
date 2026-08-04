import api from '../../../../services/api';
import {
  deleteClient,
  getClientHistory,
  getClientProfile,
  updateClientProfile,
} from '../clientProfileAPI';

jest.mock('../../../../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const clientFixture = {
  id: 12,
  name: 'Ana',
  lastName: 'Silva',
  phone: '11999999999',
  email: 'ana@example.com',
  preferencesNotes: 'Prefere natural',
};

const historyFixture = {
  appointments: [{
    id: 50,
    clientId: 12,
    status: 'completed',
    startAt: '2026-08-01T12:00:00.000Z',
    endAt: '2026-08-01T13:00:00.000Z',
    serviceName: 'Design de sobrancelhas',
  }],
  nextCursor: 'next-page',
};

describe('clientProfileAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('busca o perfil atual da cliente', async () => {
    api.get.mockResolvedValue({ data: clientFixture });

    await expect(getClientProfile(12)).resolves.toEqual(clientFixture);

    expect(api.get).toHaveBeenCalledWith('/clients/12/profile');
  });

  it('busca histÃ³rico com cursor e limite sem montar query manual', async () => {
    api.get.mockResolvedValue({ data: historyFixture });

    await expect(getClientHistory(12, 'opaque', 10)).resolves.toEqual(historyFixture);

    expect(api.get).toHaveBeenCalledWith('/clients/12/appointments/history', {
      params: { cursor: 'opaque', limit: 10 },
    });
  });

  it('busca histÃ³rico com o limite padrÃ£o e sem cursor quando ele Ã© nulo', async () => {
    api.get.mockResolvedValue({ data: historyFixture });

    await expect(getClientHistory(12, null)).resolves.toEqual(historyFixture);

    expect(api.get).toHaveBeenCalledWith('/clients/12/appointments/history', {
      params: { limit: 10 },
    });
  });

  it('omite o cursor do histÃ³rico quando ele Ã© indefinido', async () => {
    api.get.mockResolvedValue({ data: historyFixture });

    await getClientHistory(12, undefined, 25);

    expect(api.get).toHaveBeenCalledWith('/clients/12/appointments/history', {
      params: { limit: 25 },
    });
  });

  it('atualiza somente o DTO operacional da cliente', async () => {
    const payload = { name: 'Ana', preferencesNotes: 'Prefere natural' };
    const updatedClientFixture = { ...clientFixture, ...payload };
    api.patch.mockResolvedValue({ data: updatedClientFixture });

    await expect(updateClientProfile(12, payload)).resolves.toEqual(updatedClientFixture);

    expect(api.patch).toHaveBeenCalledWith('/clients/update/12', payload);
  });

  it('exclui a cliente pelo endpoint operacional', async () => {
    const deletedClientFixture = { success: true, client: clientFixture };
    api.delete.mockResolvedValue({ data: deletedClientFixture });

    await expect(deleteClient(12)).resolves.toEqual(deletedClientFixture);

    expect(api.delete).toHaveBeenCalledWith('/clients/delete/12');
  });

  it.each([
    ['getClientProfile', () => getClientProfile(12), 'get'],
    ['getClientHistory', () => getClientHistory(12), 'get'],
    ['updateClientProfile', () => updateClientProfile(12, { name: 'Ana' }), 'patch'],
    ['deleteClient', () => deleteClient(12), 'delete'],
  ])('propaga o erro de %s sem convertÃª-lo', async (_method, request, apiMethod) => {
    const error = new Error('Falha de rede');
    api[apiMethod].mockRejectedValue(error);

    await expect(request()).rejects.toBe(error);
  });
});
