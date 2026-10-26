import {
  buildServiceSnapshotMap,
  hasCatalogPriceUpdate,
  resolveAppointmentServices,
} from '../appointmentPricing';

// Cenario de referencia: a cliente foi agendada em outubro, com o servico a
// R$ 80 / 60 min. Em novembro a tabela foi reajustada para R$ 100 / 90 min.
const snapshotRow = {
  id: 7,
  serviceId: 7,
  name: 'Maquiagem',
  serviceName: 'Maquiagem',
  price: 80,
  estimatedTime: 60,
};

const catalogService = {
  id: 7,
  name: 'Maquiagem',
  price: 100,
  estimatedTime: 90,
};

const otherCatalogService = {
  id: 9,
  name: 'Design de sobrancelha',
  price: 50,
  estimatedTime: 30,
};

describe('buildServiceSnapshotMap', () => {
  it('indexa pelo serviceId, nao pelo id da linha do snapshot', () => {
    const snapshotById = buildServiceSnapshotMap([{ id: 123, serviceId: 7, price: 80 }]);

    expect(snapshotById.get(7)).toEqual({ id: 123, serviceId: 7, price: 80 });
    expect(snapshotById.has(123)).toBe(false);
  });

  it('cai no id quando o snapshot nao traz serviceId', () => {
    const snapshotById = buildServiceSnapshotMap([{ id: 7, price: 80 }]);

    expect(snapshotById.get(7)).toEqual({ id: 7, price: 80 });
  });

  it('aceita lista vazia', () => {
    expect(buildServiceSnapshotMap().size).toBe(0);
  });
});

describe('resolveAppointmentServices', () => {
  const snapshotById = buildServiceSnapshotMap([snapshotRow]);

  it('preserva o preco e a duracao combinados mesmo depois do reajuste', () => {
    const resolved = resolveAppointmentServices({
      serviceIds: [7],
      snapshotById,
      catalogServices: [catalogService],
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0].price).toBe(80);
    expect(resolved[0].estimatedTime).toBe(60);
  });

  it('adota o preco e a duracao de hoje sob refreshPrices', () => {
    const resolved = resolveAppointmentServices({
      serviceIds: [7],
      snapshotById,
      catalogServices: [catalogService],
      refreshPrices: true,
    });

    expect(resolved[0].price).toBe(100);
    expect(resolved[0].estimatedTime).toBe(90);
  });

  it('usa o catalogo para servico adicionado agora, sem tocar no que ja estava', () => {
    const resolved = resolveAppointmentServices({
      serviceIds: [7, 9],
      snapshotById,
      catalogServices: [catalogService, otherCatalogService],
    });

    expect(resolved.map((item) => item.price)).toEqual([80, 50]);
  });

  it('mantem o servico que saiu do catalogo, inclusive sob refreshPrices', () => {
    const resolved = resolveAppointmentServices({
      serviceIds: [7],
      snapshotById,
      catalogServices: [],
      refreshPrices: true,
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0].price).toBe(80);
    expect(resolved[0].name).toBe('Maquiagem');
  });

  it('preserva a ordem dos ids selecionados', () => {
    const resolved = resolveAppointmentServices({
      serviceIds: [9, 7],
      snapshotById,
      catalogServices: [catalogService, otherCatalogService],
    });

    expect(resolved.map((item) => Number(item.serviceId ?? item.id))).toEqual([9, 7]);
  });

  it('descarta id que nao existe nem no snapshot nem no catalogo', () => {
    const resolved = resolveAppointmentServices({
      serviceIds: [7, 404],
      snapshotById,
      catalogServices: [catalogService],
    });

    expect(resolved).toHaveLength(1);
  });

  it('compara ids numericamente, tolerando string vinda do formulario', () => {
    const resolved = resolveAppointmentServices({
      serviceIds: ['7'],
      snapshotById,
      catalogServices: [catalogService],
    });

    expect(resolved[0].price).toBe(80);
  });

  it('nao quebra sem argumento nenhum', () => {
    expect(resolveAppointmentServices({})).toEqual([]);
  });
});

describe('hasCatalogPriceUpdate', () => {
  const snapshotById = buildServiceSnapshotMap([snapshotRow]);

  it('acusa divergencia de preco', () => {
    expect(hasCatalogPriceUpdate({
      serviceIds: [7],
      snapshotById,
      catalogServices: [{ ...catalogService, estimatedTime: 60 }],
    })).toBe(true);
  });

  it('acusa divergencia so de duracao', () => {
    expect(hasCatalogPriceUpdate({
      serviceIds: [7],
      snapshotById,
      catalogServices: [{ ...catalogService, price: 80 }],
    })).toBe(true);
  });

  it('fica quieto quando o catalogo nao mudou', () => {
    expect(hasCatalogPriceUpdate({
      serviceIds: [7],
      snapshotById,
      catalogServices: [{ id: 7, name: 'Maquiagem', price: 80, estimatedTime: 60 }],
    })).toBe(false);
  });

  it('ignora diferenca de centavo abaixo do arredondamento', () => {
    expect(hasCatalogPriceUpdate({
      serviceIds: [7],
      snapshotById,
      catalogServices: [{ id: 7, price: 80.004, estimatedTime: 60 }],
    })).toBe(false);
  });

  it('nao acusa servico adicionado agora, que ja nasce com o preco de hoje', () => {
    expect(hasCatalogPriceUpdate({
      serviceIds: [9],
      snapshotById,
      catalogServices: [otherCatalogService],
    })).toBe(false);
  });

  it('nao acusa servico que saiu do catalogo, sem base de comparacao', () => {
    expect(hasCatalogPriceUpdate({
      serviceIds: [7],
      snapshotById,
      catalogServices: [],
    })).toBe(false);
  });

  it('fica quieto em agendamento novo, sem snapshot', () => {
    expect(hasCatalogPriceUpdate({
      serviceIds: [7],
      snapshotById: buildServiceSnapshotMap([]),
      catalogServices: [catalogService],
    })).toBe(false);
  });

  it('basta um servico divergente entre varios', () => {
    expect(hasCatalogPriceUpdate({
      serviceIds: [9, 7],
      snapshotById,
      catalogServices: [catalogService, otherCatalogService],
    })).toBe(true);
  });
});
