// filepath: src/screens/LoginScreen.jsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import validator from 'validator';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');



  const handleLogin = () => {

    if (!email) {
      Alert.alert(
        'Digite o e-mail, por favor!',
        'O campo de e-mail não pode ser vazio.',
        [{
          text: 'Perfeito',
        }]
      );
      return;
    } else if (!password) {
      Alert.alert(
        'Digite a senha, por favor!',
        'O campo de senha não pode ser vazio.',
        [{
          text: 'Perfeito',
        }]
      );
      return;
    }

    if (!validator.isEmail(email)) {
      Alert.alert(
        'E-mail inválido',
        'Por favor, insira um e-mail válido.',
        [{
          text: 'Perfeito',
        }]
      );
      return;
    }

    fetch('https://263a-179-109-206-16.ngrok-free.app/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({ email, password }),
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          navigation.navigate('Main');
        } else {
          console.log(data);
          Alert.alert(
            'Login falhou',
            data.message,
            [{
              text: 'Tentar novamente',
            }]
          );
        }
      })
      .catch(error => {
        Alert.alert(
          'Erro',
          'Ocorreu um erro ao tentar fazer login. Por favor, tente novamente mais tarde.',
          [{
            text: 'OK',
          }]
        );
      });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
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
        <Button
          title="Esqueci minha senha"
          onPress={() => navigation.navigate('ForgotPassword')}
        />
      </View>

      <View style={styles.button}>
        <Button title="Entrar" onPress={handleLogin} />
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
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  button: {
    marginTop: 10,
    borderRadius: 8,
  }
});

export default LoginScreen;