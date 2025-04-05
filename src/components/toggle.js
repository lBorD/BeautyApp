import React from 'react';
import { View, Switch, StyleSheet, Text } from 'react-native';
import colors from '../constants/colors';


const Toggle = ({ value, onValueChange, label, textPosition = 'left' }) => {
  const renderContent = () => {
    const switchComponent = (
      <Switch
        key="switch"
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.darkGray, true: colors.secondary }}
        thumbColor={value ? "#fff" : "#f4f3f4"}
        style={styles.switch}
      />
    );

    const textComponent = label ? (
      <Text key="text" style={styles.label}>{label}</Text>
    ) : null;

    return textPosition === 'left'
      ? [textComponent, switchComponent]
      : [switchComponent, textComponent];
  };

  return (
    <View style={styles.container}>
      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    padding: 10,
    width: '100%',
  },
  switch: {
    transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }],
  },
  label: {
    fontSize: 16,
    color: colors.secondary,
    paddingRight: 10,
    paddingLeft: 10,
  }
});

export default Toggle;