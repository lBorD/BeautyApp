import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { TextInput } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import Button from '../../components/button';
import FeedbackModal from '../../components/FeedbackModal';
import api from '../../services/api';
import formatPhoneNumber from '../../utils/formatNumber';
import { validateFormData } from '../../utils/validations';
import { formatDate } from '../../utils/formatBirthday';
import colors from '../../constants/colors';
import useFeedbackModal from '../../hooks/useFeedbackModal';

export default function RegisterClientScreeen() {
  const navigation = useNavigation();
  const { feedback, showFeedback, hideFeedback } = useFeedbackModal();
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
      email: formData.email.trim() || null,
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
        showFeedback({
          type: 'success',
          title: 'Sucesso',
          message: 'Cliente cadastrado com sucesso!',
          onClose: () => navigation.goBack(),
        });
      } else {
        showFeedback({
          type: 'error',
          title: 'Erro',
          message: 'Não foi possível cadastrar o cliente!',
        });
      }
    } catch (error) {
      if (error.response) {
        console.error('Erro ao registrar cliente:', error.response.data.message);
        showFeedback({
          type: 'error',
          title: 'Erro',
          message: error.response.data.error || 'Erro ao cadastrar cliente',
        });
      } else {
        console.error('Erro ao registrar cliente:', error.message);
        showFeedback({
          type: 'error',
          title: 'Erro',
          message: 'Falha na conexão com o servidor',
        });
      }
    }
  };

  return (
    <>
      <ScrollView style={styles.container}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Cadastro de Cliente</Text>

          <TextInput
            style={styles.input}
            mode="outlined"
            label="Nome *"
            value={formData.name}
            onChangeText={(value) => handleInputChange('name', value)}
          />

          <TextInput
            style={styles.input}
            mode="outlined"
            label="Sobrenome"
            value={formData.lastName}
            onChangeText={(value) => handleInputChange('lastName', value)}
          />

          <TextInput
            style={styles.input}
            mode="outlined"
            label="Email (opcional)"
            keyboardType="email-address"
            textContentType="emailAddress"
            value={formData.email}
            onChangeText={(value) => handleInputChange('email', value)}
          />

          <TextInput
            style={styles.input}
            mode="outlined"
            label="Telefone *"
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
              label="Data de Nascimento *"
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
            label="Endereço"
            value={formData.address}
            onChangeText={(value) => handleInputChange('address', value)}
          />

          <Text style={styles.helperText}>* Campos obrigatórios</Text>

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

      <FeedbackModal
        visible={feedback.visible}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        buttonText={feedback.buttonText}
        onClose={hideFeedback}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.text,
  },
  input: {
    height: 50,
    marginBottom: 5,
    fontSize: 16,
  },
  helperText: {
    color: colors.darkGray,
    fontSize: 12,
    marginBottom: 20,
    marginLeft: 5,
    fontStyle: 'italic',
  },
});
