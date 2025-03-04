// filepath: src/navigation/AppNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import ClientesScreen from '../screens/ClienteScreen';
import FinancasScreen from '../screens/FinancaScreen';
import AgendaScreen from '../screens/AgendaScreen';
import RelatorioScreen from '../screens/RelatorioScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LoginScreen from '../screens/LoginScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// TabNavigator (Main)
const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = 'home';
          } else if (route.name === 'Clientes') {
            iconName = 'people';
          } else if (route.name === 'Finanças') {
            iconName = 'cash';
          } else if (route.name === 'Agenda') {
            iconName = 'calendar';
          } else if (route.name === 'Relatório') {
            iconName = 'document';
          } else if (route.name === 'Configurações') {
            iconName = 'settings';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: 'tomato',
        tabBarInactiveTintColor: 'gray',
        headerShown: false, // Oculta o cabeçalho nas telas do TabNavigator
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Clientes" component={ClientesScreen} />
      <Tab.Screen name="Finanças" component={FinancasScreen} />
      <Tab.Screen name="Agenda" component={AgendaScreen} />
      <Tab.Screen name="Relatório" component={RelatorioScreen} />
      <Tab.Screen name="Configurações" component={SettingsScreen} />
    </Tab.Navigator>
  );
};

// AppNavigator
const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }} // Oculta o cabeçalho na tela de Login
        />
        <Stack.Screen
          name="Main"
          component={TabNavigator}
          options={{ headerShown: false }} // Oculta o cabeçalho na tela Main
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;