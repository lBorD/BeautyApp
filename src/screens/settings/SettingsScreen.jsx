import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../constants/colors';
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
} from '../../services/private/googleCalendarAPI';
import { logout } from '../../services/sessionManager';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
};
const GOOGLE_CLIENT_ID = Constants.expoConfig?.extra?.googleOAuthClientId || '';
const GOOGLE_REDIRECT_URI = 'com.bordd.beautyapp:/oauth/google';

const SettingsScreen = () => {
  const [calendarStatus, setCalendarStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const handledAuthCodeRef = useRef(null);

  const redirectUri = useMemo(() => AuthSession.makeRedirectUri({
    native: GOOGLE_REDIRECT_URI,
  }), []);
  const hasGoogleClientId = Boolean(GOOGLE_CLIENT_ID);
  const [request, response, promptAsync] = AuthSession.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID || 'missing-google-client-id',
    responseType: AuthSession.ResponseType.Code,
    scopes: [GOOGLE_CALENDAR_SCOPE],
    redirectUri,
    usePKCE: true,
    extraParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  }, GOOGLE_DISCOVERY);
  const isConnected = Boolean(calendarStatus?.connected && calendarStatus?.enabled);

  const loadCalendarStatus = async () => {
    setLoadingStatus(true);

    try {
      const status = await getGoogleCalendarStatus();
      setCalendarStatus(status);
    } catch (error) {
      console.error('Erro ao carregar status Google Calendar:', error.response?.data || error.message);
      Alert.alert('Erro', 'Não foi possível carregar o Google Calendar.');
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadCalendarStatus();
  }, []);

  useEffect(() => {
    const finishConnection = async () => {
      if (response?.type !== 'success') {
        if (response?.type === 'error') {
          Alert.alert('Erro', 'Não foi possível conectar o Google Calendar.');
        }
        if (response) {
          setConnecting(false);
        }
        return;
      }

      const code = response.params?.code;
      const codeVerifier = request?.codeVerifier;

      if (!code || !codeVerifier) {
        Alert.alert('Erro', 'Não foi possível concluir a autenticação.');
        return;
      }

      if (handledAuthCodeRef.current === code) {
        return;
      }

      handledAuthCodeRef.current = code;
      setConnecting(true);

      try {
        const status = await connectGoogleCalendar({ code, codeVerifier, redirectUri });
        setCalendarStatus(status);
      } catch (error) {
        console.error('Erro ao conectar Google Calendar:', error.response?.data || error.message);
        Alert.alert('Erro', error.response?.data?.error || 'Não foi possível conectar o Google Calendar.');
      } finally {
        setConnecting(false);
      }
    };

    finishConnection();
  }, [response, request, redirectUri]);

  const handleLogout = async () => {
    try {
      await logout({ reason: 'manual' });
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      Alert.alert('Erro', 'Não foi possível sair agora. Tente novamente.');
    }
  };

  const handleConnectGoogleCalendar = async () => {
    if (!hasGoogleClientId || !request || connecting) {
      return;
    }

    setConnecting(true);

    try {
      await promptAsync({ redirectUri });
    } catch (error) {
      console.error('Erro ao iniciar OAuth Google Calendar:', error);
      Alert.alert('Erro', 'Não foi possível iniciar a conexão.');
      setConnecting(false);
    }
  };

  const handleDisconnectGoogleCalendar = async () => {
    if (disconnecting) {
      return;
    }

    Alert.alert(
      'Desconectar Google Calendar',
      'Os próximos agendamentos ficarão apenas no BeautyApp.',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: async () => {
            setDisconnecting(true);

            try {
              const status = await disconnectGoogleCalendar();
              setCalendarStatus(status);
            } catch (error) {
              console.error('Erro ao desconectar Google Calendar:', error.response?.data || error.message);
              Alert.alert('Erro', 'Não foi possível desconectar agora.');
            } finally {
              setDisconnecting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Configurações</Text>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="logo-google" size={22} color={colors.primary} />
            <Text style={styles.sectionTitle}>Google Calendar</Text>
          </View>
          {loadingStatus ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <View style={[styles.statusPill, isConnected ? styles.statusConnected : styles.statusDisconnected]}>
              <Text style={styles.statusPillText}>{isConnected ? 'Conectado' : 'Desconectado'}</Text>
            </View>
          )}
        </View>

        <View style={styles.statusRows}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Calendário</Text>
            <Text style={styles.statusValue}>{calendarStatus?.calendarId || 'primary'}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Último sync</Text>
            <Text style={styles.statusValue}>
              {calendarStatus?.lastSyncAt ? new Date(calendarStatus.lastSyncAt).toLocaleString('pt-BR') : '-'}
            </Text>
          </View>
          {calendarStatus?.lastSyncError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{calendarStatus.lastSyncError}</Text>
            </View>
          )}
        </View>

        {!isConnected ? (
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!hasGoogleClientId || !request || connecting || loadingStatus) && styles.disabledButton,
            ]}
            onPress={handleConnectGoogleCalendar}
            disabled={!hasGoogleClientId || !request || connecting || loadingStatus}
          >
            <Text style={styles.primaryButtonText}>
              {connecting ? 'Conectando...' : hasGoogleClientId ? 'Conectar' : 'Credenciais pendentes'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.secondaryButton, disconnecting && styles.disabledButton]}
            onPress={handleDisconnectGoogleCalendar}
            disabled={disconnecting}
          >
            <Text style={styles.secondaryButtonText}>
              {disconnecting ? 'Desconectando...' : 'Desconectar'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 56,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 20,
  },
  section: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusConnected: {
    backgroundColor: colors.success,
  },
  statusDisconnected: {
    backgroundColor: colors.darkGray,
  },
  statusPillText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusRows: {
    marginTop: 14,
    gap: 10,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusLabel: {
    color: colors.darkGray,
    fontSize: 13,
  },
  statusValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
  errorBox: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 8,
    padding: 10,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.error,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.55,
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  logoutButtonText: {
    color: colors.text,
    fontWeight: '700',
  },
});

export default SettingsScreen;
