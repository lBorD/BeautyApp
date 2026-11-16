import { getAppointmentAuthorLines } from '../appointmentAuthors';

const juliana = { id: 1, name: 'Juliana' };
const maria = { id: 7, name: 'Maria' };

describe('getAppointmentAuthorLines', () => {
  it('nao mostra nada em agendamento anterior ao registro de autoria', () => {
    expect(getAppointmentAuthorLines({ createdBy: null, updatedBy: null })).toEqual([]);
    expect(getAppointmentAuthorLines({})).toEqual([]);
  });

  it('mostra quem agendou', () => {
    expect(getAppointmentAuthorLines({ createdBy: maria, updatedBy: null }))
      .toEqual(['Agendado por Maria']);
  });

  it('nao repete o nome quando quem alterou foi quem agendou', () => {
    expect(getAppointmentAuthorLines({ createdBy: maria, updatedBy: maria }))
      .toEqual(['Agendado por Maria']);
  });

  it('mostra quem alterou quando foi outra pessoa', () => {
    expect(getAppointmentAuthorLines({ createdBy: maria, updatedBy: juliana }))
      .toEqual(['Agendado por Maria', 'Alterado por Juliana']);
  });

  it('mostra so quem alterou quando o agendamento e anterior ao registro', () => {
    expect(getAppointmentAuthorLines({ createdBy: null, updatedBy: juliana }))
      .toEqual(['Alterado por Juliana']);
  });
});
