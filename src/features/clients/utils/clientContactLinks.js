export function normalizeBrazilianPhone(phone) {
  if (phone === null || phone === undefined) {
    return null;
  }

  const value = String(phone).trim();
  if (!value) {
    return null;
  }

  const hasCountryCodePrefix = value.startsWith('+');
  const isValidFormat = hasCountryCodePrefix
    ? /^\+55[\d\s().-]*$/.test(value)
    : /^[\d\s().-]+$/.test(value);

  if (!isValidFormat) {
    return null;
  }

  const digits = value.replace(/\D/g, '');
  if (!hasCountryCodePrefix && (digits.length === 10 || digits.length === 11)) {
    return `55${digits}`;
  }

  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return digits;
  }

  return null;
}

export function buildPhoneUrl(phone) {
  const normalizedPhone = normalizeBrazilianPhone(phone);
  return normalizedPhone ? `tel:+${normalizedPhone}` : null;
}

export function buildWhatsAppUrl(phone) {
  const normalizedPhone = normalizeBrazilianPhone(phone);
  return normalizedPhone ? `https://wa.me/${normalizedPhone}` : null;
}
