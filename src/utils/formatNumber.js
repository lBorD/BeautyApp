export default function formatPhoneNumber(text) {
  let cleaned = text.replace(/\D/g, '').replace(/^55/, '');

  let formatted = '+55 ';
  if (cleaned.length > 0) {
    if (cleaned.length <= 2) {
      formatted += `(${cleaned}`;
    } else if (cleaned.length <= 7) {
      formatted += `(${cleaned.substring(0, 2)}) ${cleaned.substring(2)}`;
    } else if (cleaned.length <= 11) {
      formatted += `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
    } else {
      formatted += `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7, 11)}`;
    }
  }
  return formatted;
};