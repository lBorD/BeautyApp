
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Alert } from 'react-native';
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

  const handleRegister = async () => {
    console.log('Form Data:', formData);
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
      } else {
        console.error('Erro ao registrar cliente:', error.message);
      }
    };
  };
  return (
    <ScrollView style={styles.container}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>Cadastro de Cliente</Text>

        <TextInput
          style={styles.input}
          placeholder="Nome"
          value={formData.name}
          onChangeText={(value) => handleInputChange('name', value)}
        />

        <TextInput
          style={styles.input}
          label="Sobrenome"
          placeholder="Sobrenome"
          value={formData.lastName}
          onChangeText={(value) => handleInputChange('lastName', value)}
        />

        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          textContentType='emailAddress'
          value={formData.email}
          onChangeText={(value) => handleInputChange('email', value)}
        />

        <TextInput
          style={styles.input}
          placeholder="Telefone"
          keyboardType="phone-pad"
          dataDetectorTypes={'phoneNumber'}
          value={formData.phone}
          onChangeText={(value) => handleInputChange('phone', value)}
        />

        <TextInput
          style={styles.input}
          placeholder="Data de Nascimento"
          value={formData.birthDate}
          onChangeText={(value) => handleInputChange('birthDate', value)}
        />

        <TextInput
          style={styles.input}
          placeholder="Endereço"
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
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
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
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 16,
    marginBottom: 4,
  }
});
