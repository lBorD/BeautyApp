// filepath: src/screens/LoginScreen.jsx
import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Alert, Image, Text } from 'react-native';
import validator from 'validator';
import api from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import Button from '../../components/button';
import Toggle from '../../components/toggle';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberLogin, setRememberLogin] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        const savedRememberLogin = await AsyncStorage.getItem('rememberLogin');

        if (savedRememberLogin === 'true') {
          const savedEmail = await AsyncStorage.getItem('userEmail');
          const savedPassword = await AsyncStorage.getItem('userPassword');

          if (savedEmail) setEmail(savedEmail);
          if (savedPassword) setPassword(savedPassword);
          setRememberLogin(true);
        }
      } catch (error) {
        console.log('Erro ao buscar o login salvo! ', error);
      }
    };

    loadSavedCredentials();
  }, []);

  const saveCredentials = async () => {
    try {
      if (rememberLogin) {
        await AsyncStorage.setItem('userEmail', email);
        await AsyncStorage.setItem('userPassword', password);
        await AsyncStorage.setItem('rememberLogin', 'true');
      } else {
        await AsyncStorage.removeItem('userEmail');
        await AsyncStorage.removeItem('userPassword');
        await AsyncStorage.setItem('rememberLogin', 'false');
      }
    } catch (error) {
      console.log('Erro ao salvar as credenciais de login! ', error);
    }
  };

  const handleLogin = async () => {
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

    try {
      const response = await api.post('/auth/login', {
        email,
        password,
      });

      if (response.data.success) {
        await saveCredentials();
        navigation.replace('Main');
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
          source={require('../../assets/adaptative-icon.png')}
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
        <Toggle
          label="Lembrar login"
          value={rememberLogin}
          onValueChange={setRememberLogin}
          textPosition="right"
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
  rememberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default LoginScreen;