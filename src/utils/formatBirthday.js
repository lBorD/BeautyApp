
export default function formatBirthDay(value) {
  if (!value) return '';

  // Remove all non-numeric characters
  const numbers = value.replace(/\D/g, '');

  // Format as yyyy-mm-dd
  if (numbers.length <= 4) {
    return numbers;
  } else if (numbers.length <= 6) {
    return `${numbers.slice(0, 4)}-${numbers.slice(4)}`;
  } else {
    return `${numbers.slice(0, 4)}-${numbers.slice(4, 6)}-${numbers.slice(6, 8)}`;
  }
}
