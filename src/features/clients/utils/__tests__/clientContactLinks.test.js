import {
  buildPhoneUrl,
  buildWhatsAppUrl,
  normalizeBrazilianPhone,
} from '../clientContactLinks';

describe('normalizeBrazilianPhone', () => {
  it.each([
    ['(11) 99999-9999', '5511999999999'],
    ['+55 11 99999-9999', '5511999999999'],
    ['5511999999999', '5511999999999'],
    ['  (11) 3333-4444  ', '551133334444'],
  ])('normaliza %s', (input, expected) => {
    expect(normalizeBrazilianPhone(input)).toBe(expected);
  });

  it.each([
    '',
    '   ',
    null,
    undefined,
    '11999',
    '+1 202 555 0100',
    'abc11999999999',
    '+5511999999999abc',
    '++55 11 99999-9999',
    '11+999999999',
  ])(
    'rejeita telefone incompleto ou fora do contrato: %s',
    (input) => {
      expect(normalizeBrazilianPhone(input)).toBeNull();
    },
  );
});

describe('links de contato', () => {
  it('gera links oficiais sem caracteres de formatação', () => {
    expect(buildPhoneUrl('(11) 99999-9999')).toBe('tel:+5511999999999');
    expect(buildWhatsAppUrl('(11) 99999-9999')).toBe('https://wa.me/5511999999999');
  });

  it('não gera link quando o telefone é inválido', () => {
    expect(buildPhoneUrl('+1 202 555 0100')).toBeNull();
    expect(buildWhatsAppUrl(null)).toBeNull();
  });
});
