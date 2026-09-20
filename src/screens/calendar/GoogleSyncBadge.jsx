import React, { useEffect, useRef, useState } from 'react';
import { LayoutAnimation, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../constants/colors';

export const googleSyncLabels = {
  pending: 'Google pendente',
  synced: 'Google sincronizado',
  failed: 'Falha no Google',
};

const googleSyncColors = {
  pending: colors.warning,
  synced: colors.success,
  failed: colors.error,
};

const EXPANDED_DURATION = 2600;
const TRANSITION_DURATION = 200;

// Em repouso mostra so a nuvem, na cor do status. O texto aparece apenas quando o
// status muda de verdade, e some sozinho depois.
//
// Manter o texto sempre visivel era a causa do desalinhamento no iOS: com
// `numberOfLines={2}` dentro de um pill estreito, o rotulo quebrava em duas linhas
// e o `alignItems: 'center'` deixava a nuvem flutuando no meio do bloco. Agora o
// texto nunca quebra (`numberOfLines={1}`) e no estado de repouso nem existe.
const GoogleSyncBadge = ({ status, reduceMotion = false }) => {
  const label = googleSyncLabels[status];
  const previousStatusRef = useRef(status);
  const collapseTimerRef = useRef(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Na montagem nao expande: abrir a agenda nao pode animar todos os cards.
    if (previousStatusRef.current === status) {
      return undefined;
    }

    previousStatusRef.current = status;

    if (!label) {
      setExpanded(false);
      return undefined;
    }

    if (!reduceMotion) {
      LayoutAnimation.configureNext({
        duration: TRANSITION_DURATION,
        create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
        update: { type: LayoutAnimation.Types.easeInEaseOut },
        delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      });
    }

    setExpanded(true);
    clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = setTimeout(() => {
      if (!reduceMotion) {
        LayoutAnimation.configureNext({
          duration: TRANSITION_DURATION,
          update: { type: LayoutAnimation.Types.easeInEaseOut },
          delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
        });
      }
      setExpanded(false);
    }, EXPANDED_DURATION);

    return undefined;
  }, [label, reduceMotion, status]);

  useEffect(() => () => clearTimeout(collapseTimerRef.current), []);

  if (!label) {
    return null;
  }

  const tone = googleSyncColors[status] || colors.darkGray;

  return (
    <View
      style={[
        styles.badge,
        expanded ? styles.badgeExpanded : styles.badgeCompact,
        { borderColor: tone },
      ]}
      accessibilityRole="image"
      // O rotulo fica sempre disponivel para o leitor de tela, mesmo compacto.
      accessibilityLabel={label}
    >
      <Ionicons
        name={status === 'failed' ? 'cloud-offline-outline' : 'cloud-done-outline'}
        size={13}
        color={tone}
      />
      {expanded && (
        <Text numberOfLines={1} style={[styles.badgeText, { color: tone }]}>
          {label}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexShrink: 0,
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  // Em repouso o pill vira um circulo com a nuvem dentro.
  badgeCompact: {
    paddingHorizontal: 4,
  },
  badgeExpanded: {
    maxWidth: '60%',
    flexShrink: 1,
    paddingHorizontal: 7,
    gap: 4,
  },
  badgeText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    // lineHeight explicito evita o desencontro vertical entre iOS e Android.
    lineHeight: 14,
  },
});

export default GoogleSyncBadge;
