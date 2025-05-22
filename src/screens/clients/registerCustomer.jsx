import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { TextInput } from 'react-native-paper';
import { FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Button from '../../components/button';
import api from '../../services/api';
import formatPhoneNumber from '../../utils/formatNumber';
import { validateFormData } from '../../utils/validations';
import validator from 'validator';
import { formatDate } from '../../utils/formatBirthday';
import colors from '../../constants/colors';

export default function RegisterClientScreeen() {
  const navigation = useNavigation();
  const [isValidEmail, setIsValidEmail] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    lastName: '',
    email: '',
    phone: '',
    birthDate: new Date(1990, 5, 1),
    address: ''
  });
  const [showDatePicker, setShowDatePicker] = useState(false);


  const handleInputChange = (field, value) => {
    if (field === 'email') {
      setIsValidEmail(validator.isEmail(value));
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

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setFormData({ ...formData, birthDate: selectedDate });
    }
  };

  const handleRegister = async () => {
    const clientToRegister = {
      ...formData,
      birthDate: formatDate(formData.birthDate)
    };
    if (!validateFormData(clientToRegister)) {
      return;
    }
    console.log('Dados do cliente a serem enviados:', clientToRegister);
    try {
      const response = await api.post('/clients/register',
        clientToRegister
      );

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
          style={styles.input}
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

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setShowDatePicker(true)}
        >
        <TextInput
          style={styles.input}
            mode="outlined"
            label="Data de Nascimento"
            editable={false}
            value={formData.birthDate instanceof Date ? formatDate(formData.birthDate) : ""}
            right={<TextInput.Icon icon="calendar" onPress={() => setShowDatePicker(true)} />}
            pointerEvents="none"
        />
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={
              formData.birthDate instanceof Date && !isNaN(formData.birthDate.getTime())
                ? formData.birthDate
                : new Date()
            }
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}

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
  inputLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: colors.text,
  },
  datePickerButton: {
    borderWidth: 1,
    borderColor: colors.shadow,
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    backgroundColor: colors.white,
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
