import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ClientesScreen from '../screens/clients/cliente';
import FinancasScreen from '../screens/finance/FinancaScreen';
import AgendaScreen from '../screens/calendar/AgendaScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterCustomerScreen from '../screens/clients/registerCustomer';
import RegisterServiceScreen from '../screens/services/RegisterServiceScreen';
import EditServiceScreen from '../screens/services/EditServiceScreen';
import ServiceScreen from '../screens/services/ServiceScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import colors from '../constants/colors';
import { getAuthToken } from '../services/authStorage';
import { setSessionExpiredHandler } from '../services/sessionManager';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const navigationRef = createNavigationContainerRef();

const loginResetState = {
  index: 0,
  routes: [{ name: 'Login' }],
};

const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <Tab.Navigator
      initialRouteName="Agenda"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName = 'ellipse';

          switch (route.name) {
            case 'Agenda':
              iconName = 'calendar';
              break;
            case 'Clientes':
              iconName = 'people';
              break;
            case 'Serviços':
              iconName = 'briefcase';
              break;
            case 'Financeiro':
              iconName = 'cash';
              break;
            case 'Configurações':
              iconName = 'settings';
              break;
            default:
              iconName = 'ellipse';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.darkGray,
        tabBarStyle: {
          height: 56 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 6,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Agenda" component={AgendaScreen} />
      <Tab.Screen name="Clientes" component={ClientesScreen} />
      <Tab.Screen name="Serviços" component={ServiceScreen} />
      <Tab.Screen name="Financeiro" component={FinancasScreen} />
      <Tab.Screen name="Configurações" component={SettingsScreen} />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [initialRouteName, setInitialRouteName] = useState('Login');
  const pendingLoginResetRef = useRef(false);

  const resetToLogin = useCallback(() => {
    if (navigationRef.isReady()) {
      navigationRef.reset(loginResetState);
      pendingLoginResetRef.current = false;
      return;
    }

    pendingLoginResetRef.current = true;
    setInitialRouteName('Login');
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      resetToLogin();
    });

    return () => {
      setSessionExpiredHandler(null);
    };
  }, [resetToLogin]);

  useEffect(() => {
    const bootstrapSession = async () => {
      try {
        const token = await getAuthToken();

        if (token) {
          setInitialRouteName('Main');
        }
      } catch (error) {
        console.error('Erro ao restaurar sessão:', error);
      } finally {
        setIsBootstrapping(false);
      }
    };

    bootstrapSession();
  }, []);

  if (isBootstrapping) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        if (pendingLoginResetRef.current) {
          navigationRef.reset(loginResetState);
          pendingLoginResetRef.current = false;
        }
      }}
    >
      <Stack.Navigator initialRouteName={initialRouteName}>
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Main" component={TabNavigator} options={{ headerShown: false }} />
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
