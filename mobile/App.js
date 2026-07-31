import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './src/i18n';
import { AppProvider } from './src/context/AppContext';
import RootNavigator from './src/navigation/RootNavigator';

// AfyaConnect — accessibility-first telemedicine for PWDs in Kenya.
// Light theme only. One AppProvider (context) wraps the whole navigator so every
// screen reads the same derived accessibility theme.
export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}
