import { isSameCurrencyAmount } from '../../utils/currency';

// Preco e duracao de um agendamento ficam congelados no momento em que ele foi
// marcado: e a tabela `appointment_services` da API que guarda esse snapshot.
// Um reajuste anual de tabela nao pode reescrever o valor combinado com a
// cliente, nem na exibicao nem no que e salvo.
//
// Estas funcoes espelham o `resolveServicesForUpdate` do backend - o snapshot
// manda na edicao, e o catalogo vivo entra so para servico adicionado agora ou
// quando a usuaria pede o preco de hoje de proposito.

export const buildServiceSnapshotMap = (snapshots = []) => new Map(
  snapshots.map((item) => [Number(item.serviceId ?? item.id), item]),
);

const findCatalogService = (catalogServices, serviceId) => catalogServices
  .find((item) => Number(item.id) === Number(serviceId));

export const resolveAppointmentServices = ({
  serviceIds = [],
  snapshotById = new Map(),
  catalogServices = [],
  refreshPrices = false,
}) => serviceIds
  .map((serviceId) => {
    const snapshot = snapshotById.get(Number(serviceId));
    const catalogService = findCatalogService(catalogServices, serviceId);

    // Servico que saiu do catalogo continua resolvendo pelo snapshot, inclusive
    // sob refreshPrices: adotar um reajuste nao pode sumir com o servico.
    return refreshPrices ? (catalogService || snapshot) : (snapshot || catalogService);
  })
  .filter(Boolean);

// Divergiu em preco ou duracao? Servico adicionado agora nao conta, porque ja
// nasce com o valor de hoje; servico fora do catalogo tambem nao, porque nao
// existe com o que comparar.
export const hasCatalogPriceUpdate = ({
  serviceIds = [],
  snapshotById = new Map(),
  catalogServices = [],
}) => serviceIds.some((serviceId) => {
  const snapshot = snapshotById.get(Number(serviceId));
  const catalogService = findCatalogService(catalogServices, serviceId);

  if (!snapshot || !catalogService) {
    return false;
  }

  return !isSameCurrencyAmount(snapshot.price, catalogService.price)
    || Number(snapshot.estimatedTime || 0) !== Number(catalogService.estimatedTime || 0);
});
