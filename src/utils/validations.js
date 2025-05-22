export const validateFormData = (formData) => {
  const validations = [
    { condition: !formData.email, message: "É necessário fornecer o e-mail para finalizar o registro." },
    { condition: !formData.name, message: "É necessário fornecer o nome para finalizar o registro." },
    { condition: !formData.phone, message: "É necessário fornecer o número de telefone para finalizar o registro." },
    { condition: !formData.birthDate, message: "É necessário fornecer a data de nascimento para finalizar o registro." },
    { condition: !validator.isEmail(formData.email), message: "E-mail inválido." },
    { condition: !validator.isDate(formData.birthDate, { format: 'YYYY-MM-DD', strictMode: true }), message: "Data de nascimento inválida. Use o formato YYYY-MM-DD." },
    { condition: new Date(formData.birthDate.split('/').reverse().join('-')) > new Date(), message: "Data de nascimento não pode ser no futuro." }
  ];

  const error = validations.find(v => v.condition);
  if (error) {
    Alert.alert("Erro", error.message);
    return false;
  }
  return true;
}