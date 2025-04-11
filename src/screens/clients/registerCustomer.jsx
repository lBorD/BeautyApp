import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import Button from '../../components/button';
import api from '../../services/api';

export default function RegisterClientScreeen() {
  const navigation = useNavigation();
  const [formData, setFormData] = useState({
    name: '',
    lastName: '',
    email: '',
    phone: '',
    birthDate: '',
    address: ''
  });

  const handleInputChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value
    });
  };
  const formatPhoneNumber = (text) => {
    // Remover o prefixo '+55' se já existir, para não duplicar
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

  const handlePhoneChange = (text) => {
    const formattedPhone = formatPhoneNumber(text);
    handleInputChange('phone', formattedPhone);
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
          "Não foi possivel cadastrar o cliente!",
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
    };
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
          style={styles.input}
          mode="outlined"
          right={<TextInput.Affix />}
          label="Email"
          keyboardType="email-address"
          textContentType='emailAddress'
          value={formData.email}
          onChangeText={(value) => handleInputChange('email', value)}
        />

        <TextInput
          style={styles.input}
          mode="outlined"
          right={<TextInput.Affix />}
          label="Telefone"
          placeholder="+55"
          keyboardType="phone-pad"
          value={formData.phone}
          onChangeText={handlePhoneChange}
          theme={{ colors: { placeholder: 'red' } }}
        />

        <TextInput
          style={styles.input}
          mode="outlined"
          right={<TextInput.Affix />}
          label="Data de Nascimento"
          placeholder="YYYY-MM-DD"
          value={formData.birthDate}
          onChangeText={(value) => handleInputChange('birthDate', value)}
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
  }
});
