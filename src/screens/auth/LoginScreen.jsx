// filepath: src/screens/LoginScreen.jsx
import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Alert, Image } from 'react-native';
import validator from 'validator';
import api from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import Button from '../../components/button';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigation = useNavigation();

  const handleLogin = async () => {
    // Validações de campo vazio e e-mail inválido
    if (!email) {
      Alert.alert(
        'Digite o e-mail, por favor!',
        'O campo de e-mail não pode ser vazio.',
        [{ text: 'Perfeito' }]
      );
      return;
    } else if (!password) {
      Alert.alert(
        'Digite a senha, por favor!',
        'O campo de senha não pode ser vazio.',
        [{ text: 'Perfeito' }]
      );
      return;
    }

    if (!validator.isEmail(email)) {
      Alert.alert(
        'E-mail inválido',
        'Por favor, insira um e-mail válido.',
        [{ text: 'Perfeito' }]
      );
      return;
    }

    // Lógica de autenticação
    try {
      const response = await api.post('/auth/login', {
        email,
        password,
      });

      if (response.data.success) {
        // Navega para a tela Main (TabNavigator) após o login bem-sucedido
        navigation.navigate('Main');
      } else {
        Alert.alert(
          'Login falhou',
          'E-mail ou senha incorretos.',
          [{ text: 'Tentar novamente' }]
        );
      }
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      Alert.alert(
        'Erro',
        'Ocorreu um erro ao tentar fazer login. Por favor, tente novamente mais tarde.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <View style={styles.button}>
          <Button title="Entrar" onPress={handleLogin} />
        </View>

        <View style={styles.button}>
          <Button
            title="Esqueci minha senha"
            onPress={() => navigation.navigate('ForgotPassword')}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  title: {
    fontSize: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    height: 50,
    borderColor: '#ECACD1cf',
    borderWidth: 2,
    marginBottom: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  button: {
    marginTop: -10,
    borderRadius: 8,
  },
  logo: {
    width: 250,
    height: 250,
    alignSelf: 'center',
    marginBottom: -50,
  },
});

export default LoginScreen;