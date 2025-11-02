import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import Button from '../../components/button';
import { updateService } from '../../services/private/serviceAPI';
import colors from '../../constants/colors';

export default function EditServiceScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { service } = route.params;

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

  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name,
        price: formatCurrencyDisplay(service.price),
        estimatedTime: service.estimatedTime.toString(),
        cost: service.cost ? formatCurrencyDisplay(service.cost) : ''
      });
    }
  }, [service]);

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

  const formatCurrencyDisplay = (value) => {
    return parseFloat(value).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
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

  const handleUpdate = async () => {
    if (!validateForm()) {
      return;
    }

    const serviceToUpdate = {
      name: formData.name.trim(),
      price: parseFloat(formData.price.replace('.', '').replace(',', '.')),
      estimatedTime: parseInt(formData.estimatedTime),
      cost: formData.cost ? parseFloat(formData.cost.replace('.', '').replace(',', '.')) : 0
    };

    console.log('Dados do serviço a serem atualizados:', serviceToUpdate);

    try {
      const response = await updateService(service.id, serviceToUpdate);

      Alert.alert(
        "Sucesso",
        "Serviço atualizado com sucesso!",
        [
          { 
            text: "OK", 
            onPress: () => {
              navigation.goBack();
              // Força atualização da lista ao voltar
              if (route.params?.onUpdate) {
                route.params.onUpdate();
              }
            }
          }
        ]
      );
    } catch (error) {
      if (error.response) {
        console.error('Erro ao atualizar serviço:', error.response.data);
        Alert.alert("Erro", error.response.data.error || "Erro ao atualizar serviço");
      } else {
        console.error('Erro ao atualizar serviço:', error.message);
        Alert.alert("Erro", "Falha na conexão com o servidor");
      }
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>Editar Serviço</Text>

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
          title="Atualizar"
          onPress={handleUpdate}
        />
        <Button
          title="Cancelar"
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
