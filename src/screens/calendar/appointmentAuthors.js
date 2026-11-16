// Linhas de autoria dos detalhes do agendamento, a partir de `createdBy` e
// `updatedBy` da API. Agendamento anterior ao registro vem com os dois nulos e
// nao mostra nada. "Alterado por" so aparece quando foi outra pessoa, senao
// repetiria o mesmo nome sem informar nada.
export const getAppointmentAuthorLines = (appointment) => {
  const createdBy = appointment?.createdBy?.name ? appointment.createdBy : null;
  const updatedBy = appointment?.updatedBy?.name ? appointment.updatedBy : null;
  const lines = [];

  if (createdBy) {
    lines.push(`Agendado por ${createdBy.name}`);
  }

  if (updatedBy && String(updatedBy.id) !== String(createdBy?.id)) {
    lines.push(`Alterado por ${updatedBy.name}`);
  }

  return lines;
};
