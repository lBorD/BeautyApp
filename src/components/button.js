
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import colors from '../constants/colors';

/**
 * Componente de botão customizável
 * @param {string} title - Texto que será exibido no botão
 * @param {function} onPress - Função que será executada ao pressionar o botão
 * @param {object} style - Estilos adicionais para customizar o botão (opcional)
 */
const Button = ({ title, onPress, style }) => {
  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={onPress}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
};
// Estilos do botão - Você pode modificar estas propriedades para alterar a aparência
const styles = StyleSheet.create({
  button: {
    // Modifique estas propriedades para alterar o formato e cor do botão
    backgroundColor: colors.secondary, // Cor de fundo do botão
    borderRadius: 8,           // Arredondamento das bordas
    padding: 15,              // Espaçamento interno
    alignItems: 'center',     // Centralização horizontal do conteúdo
    justifyContent: 'center', // Centralização vertical do conteúdo
    width: '80%',            // Largura do botão
    marginVertical: 10,
    alignSelf: 'center'     // Margem vertical
  },
  buttonText: {
    // Modifique estas propriedades para alterar o texto do botão
    color: '#FFFFFF',        // Cor do texto
    fontSize: 16,           // Tamanho da fonte
    fontWeight: 'bold',     // Peso da fonte
  },
});
export default Button;
