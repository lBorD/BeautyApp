import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

const HomeScreen = ({ navigation }) => {
  useEffect(() => {
    NavigationBar.setBackgroundColorAsync('#FC1DDE');
  }, []);''

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home Screen</Text>
      <View style={styles.content}>
        {/* Other content can go here */}
      </View>
      <View style={styles.navbarContainer}>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navbarContainer: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
  },
  title: {
    fontSize: 24,
    marginBottom: 16,
  },
});

export default HomeScreen;