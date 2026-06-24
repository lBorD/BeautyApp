import validator from 'validator';
import { Alert } from 'react-native';

export const validateFormData = (formData) => {
  const name = typeof formData.name === 'string' ? formData.name.trim() : formData.name;
  const email = typeof formData.email === 'string' ? formData.email.trim() : formData.email;
  const birthDate = typeof formData.birthDate === 'string' ? formData.birthDate.trim() : formData.birthDate;
  const hasBirthDate = typeof birthDate === 'string' && birthDate.length > 0;

  const validations = [
    { condition: !name, message: 'É necessário fornecer o nome para finalizar o registro.' },
    { condition: Boolean(email) && !validator.isEmail(email), message: 'E-mail inválido.' },
    {
      condition: hasBirthDate && !validator.isDate(birthDate, { format: 'YYYY-MM-DD', strictMode: true }),
      message: 'Data de nascimento inválida. Use o formato DD/MM/AAAA.',
    },
    {
      condition: hasBirthDate && new Date(`${birthDate}T00:00:00`) > new Date(),
      message: 'Data de nascimento não pode ser no futuro.',
    },
  ];

  const error = validations.find((validation) => validation.condition);
  if (error) {
    Alert.alert('Erro', error.message);
    return false;
  }

  return true;
};
