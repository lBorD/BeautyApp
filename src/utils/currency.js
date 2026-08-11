export const MAX_INT_DIGITS = 9;

export const roundCurrency = (value = 0) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const formatCurrency = (value = 0) => Number(value || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export const formatCurrencyInput = (value = 0) => roundCurrency(value).toLocaleString('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const sanitizeCurrencyInput = (value = '') => String(value).replace(/[^\d.,]/g, '');

export const parseCurrencyInput = (value = '') => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? roundCurrency(value) : null;
  }

  const sanitizedValue = sanitizeCurrencyInput(value);
  if (!sanitizedValue) {
    return 0;
  }

  const lastComma = sanitizedValue.lastIndexOf(',');
  const lastDot = sanitizedValue.lastIndexOf('.');
  const normalizedValue = lastComma > lastDot
    ? sanitizedValue.replace(/\./g, '').replace(',', '.')
    : sanitizedValue.replace(/,/g, '');
  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? roundCurrency(parsedValue) : null;
};

export const isSameCurrencyAmount = (firstValue = 0, secondValue = 0) => (
  Math.abs(roundCurrency(firstValue) - roundCurrency(secondValue)) < 0.01
);

export const calculateRemainingAmount = (price = 0, depositAmount = 0) => {
  const total = Math.max(Number(price || 0), 0);
  const deposit = Math.max(Number(depositAmount || 0), 0);
  return roundCurrency(Math.max(total - deposit, 0));
};

export const calculateDepositAmount = (price = 0, percent = 0) => (
  roundCurrency((Number(price || 0) * Number(percent || 0)) / 100)
);

export const inferDepositPercent = (depositAmount = 0, price = 0, percentOptions = []) => {
  const numericPrice = Number(price || 0);
  const numericDeposit = Number(depositAmount || 0);

  if (!numericPrice || !Number.isFinite(numericPrice) || !Number.isFinite(numericDeposit)) {
    return null;
  }

  return percentOptions.find((option) => (
    isSameCurrencyAmount(calculateDepositAmount(numericPrice, option), numericDeposit)
  )) ?? null;
};

// A partir daqui fica a maquina de estados do campo de moeda em tempo real.
//
// A fonte de verdade nao e o texto exibido, e sim um buffer de digitos. Isso permite
// manter as duas casas decimais sempre visiveis e ainda assim tratar cada digito novo
// como REAL, e nao como centavo: enquanto o usuario digita a parte inteira o cursor
// fica ancorado imediatamente antes da virgula.

const normalizeIntDigits = (value = '') => String(value).replace(/\D/g, '').replace(/^0+(?=\d)/, '');

const groupIntDigits = (value = '') => (
  (normalizeIntDigits(value) || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
);

const countDigits = (text = '') => (String(text).match(/\d/g) || []).length;

const clampDecimalPosition = (position) => Math.min(Math.max(position, 0), 1);

export const createEmptyCurrencyBuffer = () => ({
  intDigits: '',
  decDigits: '00',
  mode: 'integer',
  decCaret: 2,
  isEmpty: true,
});

export const createCurrencyBufferFromAmount = (amount = 0) => {
  const safeAmount = Math.max(roundCurrency(Number(amount) || 0), 0);
  const [intPart, decPart] = safeAmount.toFixed(2).split('.');

  return {
    intDigits: normalizeIntDigits(intPart) || '0',
    decDigits: decPart,
    mode: 'integer',
    decCaret: 2,
    isEmpty: false,
  };
};

export const formatCurrencyBuffer = (buffer) => {
  if (buffer.isEmpty) {
    return '';
  }

  const intText = groupIntDigits(buffer.intDigits);

  // Estado transitorio logo depois de digitar a virgula, antes do primeiro centavo.
  if (buffer.mode === 'decimal' && buffer.decCaret === 0 && buffer.decDigits === '00') {
    return `${intText},`;
  }

  return `${intText},${buffer.decDigits}`;
};

export const getCurrencyBufferSelection = (buffer) => {
  if (buffer.isEmpty) {
    return { start: 0, end: 0 };
  }

  const commaIndex = formatCurrencyBuffer(buffer).indexOf(',');
  const position = buffer.mode === 'decimal'
    ? commaIndex + 1 + buffer.decCaret
    : commaIndex;

  return { start: position, end: position };
};

export const getCurrencyBufferAmount = (buffer) => (
  buffer.isEmpty ? 0 : roundCurrency(Number(`${buffer.intDigits || '0'}.${buffer.decDigits}`))
);

// Menor diferenca entre o texto que renderizamos e o texto que voltou do nativo.
// Trabalhar por diff evita depender da selecao reportada pelo TextInput, que diverge
// entre iOS e Android, e ainda cobre o caso do usuario tocar no meio do numero.
const diffText = (previous, next) => {
  let start = 0;
  while (start < previous.length && start < next.length && previous[start] === next[start]) {
    start += 1;
  }

  let endPrevious = previous.length;
  let endNext = next.length;
  while (endPrevious > start && endNext > start && previous[endPrevious - 1] === next[endNext - 1]) {
    endPrevious -= 1;
    endNext -= 1;
  }

  return {
    start,
    removed: previous.slice(start, endPrevious),
    inserted: next.slice(start, endNext),
  };
};

const withIntDigits = (buffer, intDigits) => {
  const nextIntDigits = normalizeIntDigits(intDigits).slice(0, MAX_INT_DIGITS);

  if (nextIntDigits === '' && buffer.decDigits === '00') {
    return createEmptyCurrencyBuffer();
  }

  return { ...buffer, intDigits: nextIntDigits, mode: 'integer' };
};

const applyInsertion = (buffer, previousText, start, inserted) => {
  if (inserted === ',' || inserted === '.') {
    return {
      ...buffer,
      isEmpty: false,
      intDigits: buffer.isEmpty ? '0' : buffer.intDigits,
      decDigits: '00',
      mode: 'decimal',
      decCaret: 0,
    };
  }

  if (!/\d/.test(inserted)) {
    return buffer;
  }

  if (buffer.isEmpty) {
    return {
      intDigits: inserted,
      decDigits: '00',
      mode: 'integer',
      decCaret: 2,
      isEmpty: false,
    };
  }

  const commaIndex = previousText.indexOf(',');

  if (start <= commaIndex) {
    const digitIndex = countDigits(previousText.slice(0, start));
    // Digitar sobre o zero inicial substitui, em vez de virar "09".
    const base = buffer.intDigits === '0' ? '' : buffer.intDigits;
    return withIntDigits(buffer, base.slice(0, digitIndex) + inserted + base.slice(digitIndex));
  }

  // Nos centavos as duas casas ja existem, entao o digito SOBRESCREVE em vez de inserir.
  const position = clampDecimalPosition(start - commaIndex - 1);
  const digits = buffer.decDigits.split('');
  digits[position] = inserted;

  return {
    ...buffer,
    decDigits: digits.join(''),
    mode: 'decimal',
    decCaret: position + 1,
  };
};

const applyRemoval = (buffer, previousText, start, removed) => {
  const commaIndex = previousText.indexOf(',');

  if (removed === ',') {
    return { ...buffer, decDigits: '00', mode: 'integer', decCaret: 2 };
  }

  if (removed === '.') {
    // Apagar um separador de milhar apaga o digito imediatamente anterior a ele.
    const digitIndex = countDigits(previousText.slice(0, start));
    return withIntDigits(
      buffer,
      buffer.intDigits.slice(0, Math.max(digitIndex - 1, 0)) + buffer.intDigits.slice(digitIndex),
    );
  }

  if (!/\d/.test(removed)) {
    return buffer;
  }

  if (start < commaIndex) {
    const digitIndex = countDigits(previousText.slice(0, start));
    return withIntDigits(
      buffer,
      buffer.intDigits.slice(0, digitIndex) + buffer.intDigits.slice(digitIndex + 1),
    );
  }

  const position = clampDecimalPosition(start - commaIndex - 1);
  const digits = buffer.decDigits.split('');
  digits[position] = '0';

  return {
    ...buffer,
    decDigits: digits.join(''),
    mode: 'decimal',
    decCaret: position,
  };
};

export const applyCurrencyInputChange = (buffer, nextText) => {
  const previousText = formatCurrencyBuffer(buffer);

  if (nextText === previousText) {
    return buffer;
  }

  const { start, removed, inserted } = diffText(previousText, nextText);

  // Colagem, ou selecao substituida: nao da para tratar como uma tecla, entao reparseia tudo.
  if (inserted.length > 1 || (inserted && removed)) {
    const amount = parseCurrencyInput(nextText);
    return amount === null ? buffer : createCurrencyBufferFromAmount(amount);
  }

  if (inserted) {
    return applyInsertion(buffer, previousText, start, inserted);
  }

  if (removed) {
    return applyRemoval(buffer, previousText, start, removed);
  }

  return buffer;
};
