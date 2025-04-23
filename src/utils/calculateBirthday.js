import { differenceInYears, parseISO } from 'date-fns'; //Não testado
export default function calculateBirthday(birthday) {
  if (!birthDate) return "Not provided";
  const birth = parseISO(birthDate);
  const today = new Date();

  let age = differenceInYears(today, birth);

  return `${age} Anos`;
};