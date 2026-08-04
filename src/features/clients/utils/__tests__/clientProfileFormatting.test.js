import {
  getClientDisplayName,
  getClientInitials,
  mergeUniqueAppointments,
} from '../clientProfileFormatting';

describe('identificação da cliente', () => {
  it('deriva iniciais dos nomes cadastrados', () => {
    expect(getClientInitials({ name: 'Ana', lastName: 'Silva' })).toBe('AS');
    expect(getClientInitials({ name: 'Ana' })).toBe('A');
  });

  it('ignora espaços e dados ausentes ao montar a identificação', () => {
    expect(getClientDisplayName({ name: ' Ana ', lastName: ' Silva ' })).toBe('Ana Silva');
    expect(getClientInitials({ name: ' Ana ', lastName: '  ' })).toBe('A');
    expect(getClientDisplayName(null)).toBe('');
    expect(getClientInitials(null)).toBe('');
  });
});

describe('mergeUniqueAppointments', () => {
  it('preserva a ordem e o objeto já existente ao deduplicar por id', () => {
    const firstAppointment = { id: 1, label: 'existente' };
    const duplicateFromNextPage = { id: 1, label: 'duplicado' };
    const nextAppointment = { id: 2, label: 'novo' };

    const merged = mergeUniqueAppointments(
      [firstAppointment],
      [duplicateFromNextPage, nextAppointment],
    );

    expect(merged).toEqual([firstAppointment, nextAppointment]);
    expect(merged[0]).toBe(firstAppointment);
  });

  it('aceita páginas ausentes como listas vazias', () => {
    expect(mergeUniqueAppointments(null, [{ id: 2 }])).toEqual([{ id: 2 }]);
    expect(mergeUniqueAppointments([{ id: 1 }], undefined)).toEqual([{ id: 1 }]);
  });
});
