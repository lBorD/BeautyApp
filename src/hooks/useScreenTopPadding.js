import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Respiro abaixo da status bar no Android.
export const SCREEN_TOP_GAP_ANDROID = 16;
// Espacamento ja validado no iOS, mantido como piso.
export const SCREEN_TOP_BASE_IOS = 56;

// Espacamento do topo das telas, que antes era um numero fixo (50 ou 56,
// dependendo da tela) e ignorava o aparelho.
//
// As duas plataformas precisam de contas diferentes porque a origem do layout
// nao e a mesma:
//
// - Android sem edge-to-edge: a status bar e opaca e fica FORA da viewport,
//   entao `insets.top` e 0 e todo o espacamento vinha do numero fixo. Era dai
//   que vinha a "testa" - 56px de vazio abaixo de uma barra que ja estava fora.
// - iOS: o app desenha sob o notch, entao `insets.top` (20 a 59, conforme o
//   modelo) ja reserva esse espaco. O piso preserva o visual atual e o
//   `Math.max` cobre a Dynamic Island, onde 56 ficava 3px dentro da ilha.
const useScreenTopPadding = () => {
  const insets = useSafeAreaInsets();

  return Platform.OS === 'android'
    ? insets.top + SCREEN_TOP_GAP_ANDROID
    : Math.max(insets.top, SCREEN_TOP_BASE_IOS);
};

export default useScreenTopPadding;
