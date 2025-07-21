import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, Alert } from 'react-native';
import Button from '../../components/button';
import colors from '../../constants/colors';
import { formatNumber } from '../../utils/formatNumber';

const initialForm = {
  name: '',
  price: '',
  duration: '',
  cost: '',
};

export default function ServiceRegisterScreen() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);

  // Máscara para valor monetário
  const handlePriceChange = (value, field) => {
    let clean = value.replace(/[^0-9]/g, '');
    let formatted = '';
    if (clean.length > 0) {
      formatted = (Number(clean) / 100).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });
    }
    setForm({ ...form, [field]: formatted });
  };

  // Máscara para minutos (apenas números)
  const handleDurationChange = (value) => {
    let clean = value.replace(/[^0-9]/g, '');
    setForm({ ...form, duration: clean });
  };

  const validate = () => {
    let newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Nome obrigatório';
    if (!form.price) newErrors.price = 'Preço obrigatório';
    if (!form.duration) newErrors.duration = 'Tempo obrigatório';
    return newErrors;
  };

  const handleSubmit = async () => {
    const validation = validate();
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    setLoading(true);
    try {
      // Substitua a URL abaixo pela sua API real
      // const response = await fetch('http://localhost:3001/api/services', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     name: form.name,
      //     price: form.price,
      //     duration: form.duration,
      //     cost: form.cost,
      //   }),
      // });
      // const data = await response.json();
      // if (!response.ok) throw new Error(data.message || 'Erro ao cadastrar');
      // Simulação local:
      const data = { ...form, id: Date.now().toString() };
      setServices([data, ...services]);
      setForm(initialForm);
      setErrors({});
      Alert.alert('Sucesso', 'Serviço cadastrado com sucesso!');
    } catch (e) {
      Alert.alert('Erro', e.message || 'Erro ao cadastrar serviço');
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.title}>Cadastro de Serviço</Text>

      <Text style={styles.label}>Nome do serviço *</Text>
      <TextInput
        style={[styles.input, errors.name && styles.inputError]}
        value={form.name}
        onChangeText={v => setForm({ ...form, name: v })}
        placeholder="Ex: Corte de cabelo"
        placeholderTextColor={colors.placeholder}
      />
      {errors.name && <Text style={styles.error}>{errors.name}</Text>}

      <Text style={styles.label}>Valor de venda *</Text>
      <TextInput
        style={[styles.input, errors.price && styles.inputError]}
        value={form.price}
        onChangeText={v => handlePriceChange(v, 'price')}
        placeholder="R$ 0,00"
        placeholderTextColor={colors.placeholder}
        keyboardType="numeric"
      />
      {errors.price && <Text style={styles.error}>{errors.price}</Text>}

      <Text style={styles.label}>Tempo estimado (min) *</Text>
      <TextInput
        style={[styles.input, errors.duration && styles.inputError]}
        value={form.duration}
        onChangeText={handleDurationChange}
        placeholder="Ex: 60"
        placeholderTextColor={colors.placeholder}
        keyboardType="numeric"
      />
      {errors.duration && <Text style={styles.error}>{errors.duration}</Text>}

      <Text style={styles.label}>Custo estimado</Text>
      <TextInput
        style={styles.input}
        value={form.cost}
        onChangeText={v => handlePriceChange(v, 'cost')}
        placeholder="R$ 0,00"
        placeholderTextColor={colors.placeholder}
        keyboardType="numeric"
      />

      <Button
        title={loading ? 'Salvando...' : 'Cadastrar Serviço'}
        onPress={handleSubmit}
        style={styles.button}
        disabled={loading}
      />
      <Text style={styles.subtitle}>Serviços cadastrados</Text>
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      data={services}
      keyExtractor={item => item.id}
      ListHeaderComponent={renderForm}
      ListEmptyComponent={<Text style={styles.empty}>Nenhum serviço cadastrado.</Text>}
      renderItem={({ item }) => (
        <View style={styles.serviceItem}>
          <Text style={styles.serviceName}>{item.name}</Text>
          <Text style={styles.serviceInfo}>Preço: {item.price} | Tempo: {item.duration} min | Custo: {item.cost || '-'}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 40,
  },
  formContainer: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    color: colors.primary,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    marginTop: 12,
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
    borderRadius: 6,
    padding: 10,
    marginTop: 4,
    color: colors.text,
    marginBottom: 4,
  },
  inputError: {
    borderColor: colors.error,
  },
  error: {
    color: colors.error,
    fontSize: 13,
    marginBottom: 4,
  },
  button: {
    marginTop: 18,
    marginBottom: 8,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 32,
    marginBottom: 8,
    color: colors.secondary,
    textAlign: 'center',
  },
  serviceItem: {
    backgroundColor: colors.inputBackground,
    padding: 12,
    borderRadius: 6,
    marginBottom: 10,
    marginHorizontal: 20,
  },
  serviceName: {
    fontWeight: 'bold',
    fontSize: 16,
    color: colors.primary,
  },
  serviceInfo: {
    color: colors.text,
    marginTop: 2,
  },
  empty: {
    color: colors.placeholder,
    textAlign: 'center',
    marginTop: 20,
  },
}); 