// filepath: src/navigation/AppNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import ClientesScreen from '../screens/ClienteScreen';
import FinancasScreen from '../screens/FinancaScreen';
import AgendaScreen from '../screens/AgendaScreen';
import RelatorioScreen from '../screens/RelatorioScreen';

const Tab = createBottomTabNavigator();

const AppNavigator = () => {
  return (
    <NavigationContainer>
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
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
        tabBarOptions={{
          activeTintColor: 'tomato',
          inactiveTintColor: 'gray',
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Clientes" component={ClientesScreen} />
        <Tab.Screen name="Finanças" component={FinancasScreen} />
        <Tab.Screen name="Agenda" component={AgendaScreen} />
        <Tab.Screen name="Relatório" component={RelatorioScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;