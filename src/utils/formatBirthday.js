import { format } from 'date-fns';

export function formatBirthDay(value) {
  if (!value) return '';

  const numbers = String(value).replace(/\D/g, '').slice(0, 8);

  if (numbers.length <= 2) {
    return numbers;
  }

  if (numbers.length <= 4) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  }

  return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4)}`;
}

export function formatDateForInput(value) {
  if (!value) return '';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return format(value, 'dd/MM/yyyy');
  }

  const dateString = String(value);
  const isoDate = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) {
    return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
  }

  return formatBirthDay(dateString);
}

export function formatDate(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return format(value, 'yyyy-MM-dd');
  }

  const dateString = String(value).trim();
  if (!dateString) return null;

  const isoDate = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) {
    return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
  }

  const numbers = dateString.replace(/\D/g, '');
  if (!numbers) return null;

  if (numbers.length !== 8) {
    return 'invalid-date';
  }

  const day = numbers.slice(0, 2);
  const month = numbers.slice(2, 4);
  const year = numbers.slice(4, 8);
  return `${year}-${month}-${day}`;
}
