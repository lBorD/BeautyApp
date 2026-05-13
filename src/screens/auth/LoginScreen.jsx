import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Alert, Image, ActivityIndicator } from 'react-native';
import validator from 'validator';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';
import { setAuthToken } from '../../services/authStorage';
import Button from '../../components/button';
import Toggle from '../../components/toggle';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberLogin, setRememberLogin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
        console.log('Erro ao buscar o login salvo:', error);
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
      console.log('Erro ao salvar credenciais:', error);
    }
  };

  const handleLogin = async () => {
    if (isLoading) {
      return;
    }

    if (!email) {
      Alert.alert('Digite o e-mail', 'O campo de e-mail não pode ficar vazio.');
      return;
    }

    if (!password) {
      Alert.alert('Digite a senha', 'O campo de senha não pode ficar vazio.');
      return;
    }

    if (!validator.isEmail(email)) {
      Alert.alert('E-mail inválido', 'Por favor, insira um e-mail válido.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.post('/auth/login', {
        email,
        password,
      });

      if (response.data.success && response.data.token) {
        await saveCredentials();
        await setAuthToken(response.data.token);
        navigation.replace('Main');
        return;
      }

      Alert.alert('Login falhou', 'E-mail ou senha incorretos.');
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      Alert.alert('Erro', 'Não foi possível fazer login agora. Tente novamente.');
    } finally {
      setIsLoading(false);
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
          <Button title={isLoading ? 'Entrando...' : 'Entrar'} onPress={handleLogin} disabled={isLoading} />
        </View>
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#ECACD1" />
          </View>
        )}
        <View style={styles.button}>
          <Button
            title="Esqueci minha senha"
            onPress={() => Alert.alert('Em breve', 'Recuperação de senha será adicionada em breve.')}
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
  loadingContainer: {
    alignItems: 'center',
    marginTop: -2,
    marginBottom: 8,
  },
  logo: {
    width: 250,
    height: 250,
    alignSelf: 'center',
    marginBottom: -50,
  },
});

export default LoginScreen;

