// AppNavigator.js
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";

import ClientesScreen from "../screens/clients/cliente";
import FinancasScreen from "../screens/finance/FinancaScreen";
import AgendaScreen from "../screens/calendar/AgendaScreen";
import LoginScreen from "../screens/auth/LoginScreen";
import RegisterCustomerScreen from "../screens/clients/registerCustomer";
import RegisterServiceScreen from "../screens/services/RegisterServiceScreen";
import EditServiceScreen from "../screens/services/EditServiceScreen";
import ServiceScreen from "../screens/services/ServiceScreen";
import colors from "../constants/colors";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TabNavigator = () => {
  return (
    <Tab.Navigator
      initialRouteName="Agenda"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName = "ellipse";

          switch (route.name) {
            case "Agenda":
              iconName = "calendar";
              break;
            case "Clientes":
              iconName = "people";
              break;
            case "Serviços":
              iconName = "briefcase";
              break;
            case "Financeiro":
              iconName = "cash";
              break;
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.darkGray,
        tabBarStyle: {
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Agenda" component={AgendaScreen} />
      <Tab.Screen name="Clientes" component={ClientesScreen} />
      <Tab.Screen name="Serviços" component={ServiceScreen} />
      <Tab.Screen name="Financeiro" component={FinancasScreen} />
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
        <Stack.Screen
          name="RegisterService"
          component={RegisterServiceScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="EditService"
          component={EditServiceScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
