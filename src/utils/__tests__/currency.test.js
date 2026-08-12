import {
  applyCurrencyInputChange,
  calculateDepositAmount,
  calculateRemainingAmount,
  createCurrencyBufferFromAmount,
  createEmptyCurrencyBuffer,
  formatCurrencyBuffer,
  getCurrencyBufferAmount,
  getCurrencyBufferSelection,
  inferDepositPercent,
  isSameCurrencyAmount,
  roundCurrency,
} from '../currency';

const DEPOSIT_PERCENT_OPTIONS = [0, 15, 30];

// Reproduz o que o TextInput nativo faz: insere/remove no cursor e devolve o texto inteiro.
const typeChar = (buffer, char) => {
  const text = formatCurrencyBuffer(buffer);
  const { start } = getCurrencyBufferSelection(buffer);
  return applyCurrencyInputChange(buffer, text.slice(0, start) + char + text.slice(start));
};

const typeChars = (buffer, chars) => [...chars].reduce(typeChar, buffer);

const backspace = (buffer) => {
  const text = formatCurrencyBuffer(buffer);
  const { start } = getCurrencyBufferSelection(buffer);
  if (start === 0) return buffer;
  return applyCurrencyInputChange(buffer, text.slice(0, start - 1) + text.slice(start));
};

const snapshot = (buffer) => ({
  text: formatCurrencyBuffer(buffer),
  cursor: getCurrencyBufferSelection(buffer).start,
  amount: getCurrencyBufferAmount(buffer),
});

describe('buffer de moeda em tempo real', () => {
  it('trata cada digito como real, nao como centavo', () => {
    let buffer = createEmptyCurrencyBuffer();

    buffer = typeChar(buffer, '9');
    expect(snapshot(buffer)).toEqual({ text: '9,00', cursor: 1, amount: 9 });

    buffer = typeChar(buffer, '0');
    expect(snapshot(buffer)).toEqual({ text: '90,00', cursor: 2, amount: 90 });

    buffer = typeChar(buffer, '0');
    expect(snapshot(buffer)).toEqual({ text: '900,00', cursor: 3, amount: 900 });

    buffer = typeChar(buffer, '0');
    expect(snapshot(buffer)).toEqual({ text: '9.000,00', cursor: 5, amount: 9000 });
  });

  it('entra nos centavos pela virgula e mantem as duas casas visiveis', () => {
    let buffer = typeChars(createEmptyCurrencyBuffer(), '9000');

    buffer = typeChar(buffer, ',');
    expect(snapshot(buffer)).toEqual({ text: '9.000,', cursor: 6, amount: 9000 });

    buffer = typeChar(buffer, '5');
    expect(snapshot(buffer)).toEqual({ text: '9.000,50', cursor: 7, amount: 9000.5 });

    buffer = typeChar(buffer, '7');
    expect(snapshot(buffer)).toEqual({ text: '9.000,57', cursor: 8, amount: 9000.57 });
  });

  it('desce a escada de volta no backspace', () => {
    let buffer = typeChars(createEmptyCurrencyBuffer(), '9000,57');

    buffer = backspace(buffer);
    expect(snapshot(buffer)).toEqual({ text: '9.000,50', cursor: 7, amount: 9000.5 });

    buffer = backspace(buffer);
    expect(snapshot(buffer)).toEqual({ text: '9.000,', cursor: 6, amount: 9000 });

    buffer = backspace(buffer);
    expect(snapshot(buffer)).toEqual({ text: '9.000,00', cursor: 5, amount: 9000 });

    buffer = backspace(buffer);
    expect(snapshot(buffer)).toEqual({ text: '900,00', cursor: 3, amount: 900 });
  });

  it('nao deixa o valor pre-preenchido contaminar o que foi digitado', () => {
    // Regressao: o campo abria com "0,00" e digitar 9 virava "0,009" = R$ 0,01.
    const prefilled = createCurrencyBufferFromAmount(0);
    expect(formatCurrencyBuffer(prefilled)).toBe('0,00');

    const buffer = typeChar(createEmptyCurrencyBuffer(), '9');
    expect(getCurrencyBufferAmount(buffer)).toBe(9);
  });

  it('digita por cima do zero inicial sem esvaziar o campo antes', () => {
    const buffer = typeChar(createCurrencyBufferFromAmount(0), '9');
    expect(snapshot(buffer)).toEqual({ text: '9,00', cursor: 1, amount: 9 });
  });

  it('aceita o ponto do teclado numerico como separador decimal', () => {
    const buffer = typeChars(createEmptyCurrencyBuffer(), '90.5');
    expect(snapshot(buffer)).toEqual({ text: '90,50', cursor: 4, amount: 90.5 });
  });

  it('sobrescreve a casa de centavo em vez de inserir', () => {
    const buffer = createCurrencyBufferFromAmount(49.5);
    // Cursor logo depois da virgula, sobre o primeiro centavo.
    const next = applyCurrencyInputChange(buffer, '49,750');
    expect(snapshot(next)).toEqual({ text: '49,70', cursor: 4, amount: 49.7 });
  });

  it('reparseia texto colado', () => {
    const buffer = applyCurrencyInputChange(createEmptyCurrencyBuffer(), 'R$ 1.234,56');
    expect(snapshot(buffer)).toEqual({ text: '1.234,56', cursor: 5, amount: 1234.56 });
  });

  it('respeita o teto de digitos da parte inteira', () => {
    const buffer = typeChars(createEmptyCurrencyBuffer(), '1234567890123');
    expect(getCurrencyBufferAmount(buffer)).toBe(123456789);
  });

  it('volta ao estado vazio quando tudo e apagado', () => {
    let buffer = typeChar(createEmptyCurrencyBuffer(), '9');
    buffer = backspace(buffer);
    expect(buffer.isEmpty).toBe(true);
    expect(formatCurrencyBuffer(buffer)).toBe('');
    expect(getCurrencyBufferAmount(buffer)).toBe(0);
  });

  it('normaliza centavos incompletos ao sair do campo', () => {
    const typed = typeChars(createEmptyCurrencyBuffer(), '90,');
    expect(formatCurrencyBuffer(typed)).toBe('90,');

    const blurred = createCurrencyBufferFromAmount(getCurrencyBufferAmount(typed));
    expect(formatCurrencyBuffer(blurred)).toBe('90,00');
  });

  it('devolve 0,00 quando o campo vazio perde o foco', () => {
    const blurred = createCurrencyBufferFromAmount(getCurrencyBufferAmount(createEmptyCurrencyBuffer()));
    expect(formatCurrencyBuffer(blurred)).toBe('0,00');
  });

  it('ignora valores negativos vindos de fora', () => {
    expect(formatCurrencyBuffer(createCurrencyBufferFromAmount(-50))).toBe('0,00');
  });
});

describe('helpers de sinal', () => {
  it('calcula o sinal por percentual', () => {
    expect(calculateDepositAmount(330, 15)).toBe(49.5);
    expect(calculateDepositAmount(330, 0)).toBe(0);
  });

  it('infere o chip a partir do valor salvo', () => {
    expect(inferDepositPercent(49.5, 330, DEPOSIT_PERCENT_OPTIONS)).toBe(15);
    expect(inferDepositPercent(99, 330, DEPOSIT_PERCENT_OPTIONS)).toBe(30);
    expect(inferDepositPercent(50, 330, DEPOSIT_PERCENT_OPTIONS)).toBeNull();
    expect(inferDepositPercent(0, 0, DEPOSIT_PERCENT_OPTIONS)).toBeNull();
  });

  it('nunca deixa o falta pagar negativo', () => {
    expect(calculateRemainingAmount(330, 400)).toBe(0);
    expect(calculateRemainingAmount(330, 49.5)).toBe(280.5);
  });

  it('compara valores com tolerancia de centavo', () => {
    expect(isSameCurrencyAmount(49.5, 49.5)).toBe(true);
    // A tolerancia e "menor que um centavo", entao 49,50 e 49,51 ainda contam como iguais.
    // Serve so como guarda de idempotencia; a comparacao exata fica com roundCurrency.
    expect(isSameCurrencyAmount(49.5, 49.51)).toBe(true);
    expect(isSameCurrencyAmount(49.5, 49.52)).toBe(false);
  });

  it('arredonda para duas casas', () => {
    expect(roundCurrency(1.005)).toBe(1.01);
    expect(roundCurrency(0.1 + 0.2)).toBe(0.3);
  });
});
