import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import Button from '../../components/button';
import FeedbackModal from '../../components/FeedbackModal';
import api from '../../services/api';
import formatPhoneNumber from '../../utils/formatNumber';
import { validateFormData } from '../../utils/validations';
import { formatBirthDay, formatDate } from '../../utils/formatBirthday';
import colors from '../../constants/colors';
import useFeedbackModal from '../../hooks/useFeedbackModal';

export default function RegisterClientScreeen() {
  const navigation = useNavigation();
  const { feedback, showFeedback, hideFeedback } = useFeedbackModal();
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    lastName: '',
    email: '',
    phone: '',
    birthDate: '',
    address: '',
  });

  const handleInputChange = (field, value) => {
    setFormData((previousData) => ({
      ...previousData,
      [field]: value,
    }));
  };

  const handlePhoneChange = (text) => {
    const formattedPhone = formatPhoneNumber(text);
    handleInputChange('phone', formattedPhone);
  };

  const handleBirthDateChange = (text) => {
    handleInputChange('birthDate', formatBirthDay(text));
  };

  const buildClientPayload = () => ({
    name: formData.name.trim(),
    lastName: formData.lastName.trim(),
    email: formData.email.trim() || null,
    phone: formData.phone.trim() || null,
    birthDate: formatDate(formData.birthDate),
    address: formData.address.trim(),
  });

  const handleRegister = async () => {
    const clientToRegister = buildClientPayload();

    if (!validateFormData(clientToRegister)) {
      return;
    }

    console.log('Dados do cliente a serem enviados:', clientToRegister);
    try {
      const response = await api.post('/clients/register', clientToRegister);

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
            label="Telefone"
            placeholder="+55"
            keyboardType="phone-pad"
            value={formData.phone}
            onChangeText={handlePhoneChange}
          />

          <TouchableOpacity
            style={styles.optionalToggle}
            activeOpacity={0.75}
            onPress={() => setShowOptionalFields((currentValue) => !currentValue)}
          >
            <Text style={styles.optionalToggleText}>
              {showOptionalFields ? 'Ocultar opções' : 'Mais opções'}
            </Text>
            <Text style={styles.optionalToggleIcon}>{showOptionalFields ? 'v' : '>'}</Text>
          </TouchableOpacity>

          {showOptionalFields && (
            <View style={styles.optionalFields}>
              <TextInput
                style={styles.input}
                mode="outlined"
                label="Email (opcional)"
                keyboardType="email-address"
                textContentType="emailAddress"
                autoCapitalize="none"
                value={formData.email}
                onChangeText={(value) => handleInputChange('email', value)}
              />

              <TextInput
                style={styles.input}
                mode="outlined"
                label="Nascimento (opcional)"
                placeholder="09/08/1999"
                keyboardType="number-pad"
                maxLength={10}
                value={formData.birthDate}
                onChangeText={handleBirthDateChange}
              />

              <TextInput
                style={styles.input}
                mode="outlined"
                label="Endereço"
                value={formData.address}
                onChangeText={(value) => handleInputChange('address', value)}
              />
            </View>
          )}

          <Text style={styles.helperText}>* Apenas nome é obrigatório.</Text>

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
  optionalToggle: {
    minHeight: 44,
    marginTop: 6,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionalToggleText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  optionalToggleIcon: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  optionalFields: {
    marginBottom: 2,
  },
  helperText: {
    color: colors.darkGray,
    fontSize: 12,
    marginBottom: 20,
    marginLeft: 5,
    fontStyle: 'italic',
  },
});
