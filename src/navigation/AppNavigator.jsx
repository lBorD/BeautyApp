// AppNavigator.js
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";

import HomeScreen from "../screens/home/HomeScreen";
import ClientesScreen from "../screens/clients/cliente";
import FinancasScreen from "../screens/finance/FinancaScreen";
import AgendaScreen from "../screens/calendar/AgendaScreen";
import RelatorioScreen from "../screens/report/RelatorioScreen";
import SettingsScreen from "../screens/settings/SettingsScreen";
import LoginScreen from "../screens/auth/LoginScreen";
import RegisterCustomerScreen from "../screens/clients/registerCustomer";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName = "home";

          switch (route.name) {
            case "Home":
              iconName = "home";
              break;
            case "Clientes":
              iconName = "people";
              break;
            case "Finanças":
              iconName = "cash";
              break;
            case "Agenda":
              iconName = "calendar";
              break;
            case "Relatório":
              iconName = "document";
              break;
            case "Configurações":
              iconName = "settings";
              break;
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "tomato",
        tabBarInactiveTintColor: "gray",
        headerShown: false,
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

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="Main"
          component={TabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="RegisterCustomer"
          component={RegisterCustomerScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
