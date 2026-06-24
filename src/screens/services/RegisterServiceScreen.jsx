import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import Button from '../../components/button';
import FeedbackModal from '../../components/FeedbackModal';
import { registerService } from '../../services/private/serviceAPI';
import colors from '../../constants/colors';
import useFeedbackModal from '../../hooks/useFeedbackModal';

export default function RegisterServiceScreen() {
  const navigation = useNavigation();
  const { feedback, showFeedback, hideFeedback } = useFeedbackModal();
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    estimatedTime: '',
    cost: ''
  });

  const [errors, setErrors] = useState({
    name: '',
    price: '',
    estimatedTime: '',
    cost: ''
  });

  const handleInputChange = (field, value) => {
    setFormData({
      ...formData,
      [field]: value
    });

    if (errors[field]) {
      setErrors({
        ...errors,
        [field]: ''
      });
    }
  };

  const formatCurrency = (value) => {
    const numericValue = value.replace(/[^0-9]/g, '');

    if (!numericValue) return '';

    const floatValue = parseFloat(numericValue) / 100;

    return floatValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const handlePriceChange = (value) => {
    const formatted = formatCurrency(value);
    handleInputChange('price', formatted);
  };

  const handleCostChange = (value) => {
    const formatted = formatCurrency(value);
    handleInputChange('cost', formatted);
  };

  const handleTimeChange = (value) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    handleInputChange('estimatedTime', numericValue);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name || formData.name.trim().length < 2) {
      newErrors.name = 'Nome deve ter no mínimo 2 caracteres';
    }

    if (!formData.price || parseFloat(formData.price.replace(',', '.')) <= 0) {
      newErrors.price = 'Preço deve ser maior que zero';
    }

    if (!formData.estimatedTime || parseInt(formData.estimatedTime) <= 0) {
      newErrors.estimatedTime = 'Tempo deve ser maior que zero';
    }

    if (formData.cost && parseFloat(formData.cost.replace(',', '.')) < 0) {
      newErrors.cost = 'Custo não pode ser negativo';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      return;
    }

    const serviceToRegister = {
      name: formData.name.trim(),
      price: parseFloat(formData.price.replace('.', '').replace(',', '.')),
      estimatedTime: parseInt(formData.estimatedTime),
      cost: formData.cost ? parseFloat(formData.cost.replace('.', '').replace(',', '.')) : 0
    };

    console.log('Dados do serviço a serem enviados:', serviceToRegister);

    try {
      const response = await registerService(serviceToRegister);

      if (response.success) {
        setFormData({
          name: '',
          price: '',
          estimatedTime: '',
          cost: ''
        });
        showFeedback({
          type: 'success',
          title: 'Sucesso',
          message: 'Serviço cadastrado com sucesso!',
          onClose: () => navigation.goBack(),
        });
      } else {
        showFeedback({
          type: 'error',
          title: 'Erro',
          message: 'Não foi possível cadastrar o serviço!',
        });
      }
    } catch (error) {
      if (error.response) {
        console.error('Erro ao registrar serviço:', error.response.data);
        showFeedback({
          type: 'error',
          title: 'Erro',
          message: error.response.data.error || 'Erro ao cadastrar serviço',
        });
      } else {
        console.error('Erro ao registrar serviço:', error.message);
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
          <Text style={styles.title}>Cadastro de Serviço</Text>

          <TextInput
            style={styles.input}
            mode="outlined"
            label="Nome do Serviço *"
            value={formData.name}
            onChangeText={(value) => handleInputChange('name', value)}
            error={!!errors.name}
          />
          {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}

          <TextInput
            style={styles.input}
            mode="outlined"
            label="Preço (R$) *"
            value={formData.price}
            keyboardType="numeric"
            onChangeText={handlePriceChange}
            error={!!errors.price}
            left={<TextInput.Affix text="R$" />}
          />
          {errors.price ? <Text style={styles.errorText}>{errors.price}</Text> : null}

          <TextInput
            style={styles.input}
            mode="outlined"
            label="Tempo Estimado (minutos) *"
            value={formData.estimatedTime}
            keyboardType="numeric"
            onChangeText={handleTimeChange}
            error={!!errors.estimatedTime}
            right={<TextInput.Affix text="min" />}
          />
          {errors.estimatedTime ? <Text style={styles.errorText}>{errors.estimatedTime}</Text> : null}

          <TextInput
            style={styles.input}
            mode="outlined"
            label="Custo (R$)"
            value={formData.cost}
            keyboardType="numeric"
            onChangeText={handleCostChange}
            error={!!errors.cost}
            left={<TextInput.Affix text="R$" />}
          />
          {errors.cost ? <Text style={styles.errorText}>{errors.cost}</Text> : null}

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
    color: colors.text,
  },
  input: {
    height: 50,
    marginBottom: 5,
    fontSize: 16,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginBottom: 10,
    marginLeft: 5,
  },
  helperText: {
    color: colors.darkGray,
    fontSize: 12,
    marginBottom: 20,
    marginLeft: 5,
    fontStyle: 'italic',
  },
});
