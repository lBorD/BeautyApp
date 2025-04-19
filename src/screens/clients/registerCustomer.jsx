import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput } from 'react-native-paper';
import { FontAwesome } from '@expo/vector-icons'; // Usando o FontAwesome do Expo
import { useNavigation } from '@react-navigation/native';
import Button from '../../components/button';
import api from '../../services/api';
import formatPhoneNumber from '../../utils/formatNumber';
import formatBirthDay from '../../utils/formatBirthday';
import validator from 'validator';

export default function RegisterClientScreeen() {
  const navigation = useNavigation();
  const [isValidEmail, setIsValidEmail] = useState(true); // Estado de validade do e-mail
  const [formData, setFormData] = useState({
    name: '',
    lastName: '',
    email: '',
    phone: '',
    birthDate: '',
    address: ''
  });

  const handleInputChange = (field, value) => {
    // Valida o e-mail sempre que o usuário digitar
    if (field === 'email') {
      setIsValidEmail(validator.isEmail(value)); // Atualiza a validade do e-mail
    }
    setFormData({
      ...formData,
      [field]: value
    });
  };

  const handlePhoneChange = (text) => {
    const formattedPhone = formatPhoneNumber(text);
    handleInputChange('phone', formattedPhone);
  };

  const handleDateChange = (text) => {
    const formattedDate = formatBirthDay(text);
    handleInputChange('birthDate', formattedDate);
  };

  const handleRegister = async () => {
    try {
      const response = await api.post('/clients/register', {
        name: formData.name,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        birthDate: formData.birthDate,
        address: formData.address
      });

      if (response.data.success) {
        Alert.alert(
          "Sucesso",
          "Cliente cadastrado com sucesso!",
          [
            { text: "OK", onPress: () => navigation.goBack() }
          ]
        );
      } else {
        Alert.alert(
          "Erro",
          "Não foi possível cadastrar o cliente!",
          [
            { text: "OK" }
          ]
        );
      }
    } catch (error) {
      if (error.response) {
        console.error('Erro ao registrar cliente:', error.response.data.message);
        Alert.alert("Erro", error.response.data.error || "Erro ao cadastrar cliente");
      } else {
        console.error('Erro ao registrar cliente:', error.message);
        Alert.alert("Erro", "Falha na conexão com o servidor");
      }
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>Cadastro de Cliente</Text>

        <TextInput
          style={styles.input}
          mode="outlined"
          label="Nome"
          value={formData.name}
          right={<TextInput.Affix />}
          onChangeText={(value) => handleInputChange('name', value)}
        />

        <TextInput
          style={styles.input}
          mode="outlined"
          right={<TextInput.Affix />}
          label="Sobrenome"
          value={formData.lastName}
          onChangeText={(value) => handleInputChange('lastName', value)}
        />

        <TextInput
          style={[
            styles.input,
            {
              borderColor: isValidEmail ? 'gray' : 'red', // Muda a cor da borda se o e-mail for inválido
            }
          ]}
          mode="outlined"
          right={<TextInput.Affix text={
            isValidEmail ?
              <FontAwesome name="check-circle" size={20} color="green" /> :
              <FontAwesome name="times-circle" size={20} color="red" />
          }
            accessibilityLabel={isValidEmail ? 'E-mail válido' : 'E-mail inválido'} />}
          label="Email"
          keyboardType="email-address"
          textContentType="emailAddress"
          value={formData.email}
          onChangeText={(value) => handleInputChange('email', value)}
        />
        {/* {!isValidEmail && (
          <Text style={styles.errorText}>E-mail inválido</Text> // Mensagem de erro dentro de <Text>
        )} */}

        <TextInput
          style={styles.input}
          mode="outlined"
          right={<TextInput.Affix />}
          label="Telefone"
          placeholder="+55"
          keyboardType="phone-pad"
          value={formData.phone}
          onChangeText={handlePhoneChange}
        />

        <TextInput
          style={styles.input}
          mode="outlined"
          right={<TextInput.Affix />}
          label="Data de Nascimento"
          placeholder="YYYY-MM-DD"
          value={formData.birthDate}
          onChangeText={handleDateChange}
        />

        <TextInput
          style={styles.input}
          mode="outlined"
          right={<TextInput.Affix />}
          label="Endereço"
          value={formData.address}
          onChangeText={(value) => handleInputChange('address', value)}
        />

        <Button
          title="Cadastrar"
          onPress={handleRegister}
        />
        <Button
          title="Voltar"
          onPress={() => navigation.goBack()}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 50,
  },
  formContainer: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    height: 50,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#FF69B4',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  errorText: {
    color: 'red',
    fontSize: 8,
    marginBottom: 5
  }
});
