import React, { useContext } from 'react';
import { Pressable, Text, View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { AppContext } from '../context/AppContext';

import LanguageSelectScreen from '../screens/LanguageSelectScreen';
import AuthScreen from '../screens/AuthScreen';
import AccessibilitySetupScreen from '../screens/AccessibilitySetupScreen';
import HomeScreen from '../screens/HomeScreen';
import SymptomReportScreen from '../screens/SymptomReportScreen';
import TriageResultScreen from '../screens/TriageResultScreen';
import QueueStatusScreen from '../screens/QueueStatusScreen';
import AppointmentsScreen from '../screens/AppointmentsScreen';
import EmergencyScreen from '../screens/EmergencyScreen';
import CaregiverProxyScreen from '../screens/CaregiverProxyScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();

// The always-reachable emergency button — ONE action to Emergency from any of
// the signed-in screens (rendered in the header). Large target + a11y complete.
function EmergencyHeaderButton({ navigation }) {
  const { theme } = useContext(AppContext);
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={() => navigation.navigate('Emergency')}
      accessibilityRole="button"
      accessibilityLabel={t('emergency.title')}
      accessibilityHint={t('emergency.openHint')}
      hitSlop={theme.hitSlop}
      style={{ backgroundColor: theme.priority.critical, minHeight: 44, minWidth: 44, paddingHorizontal: 14, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}
    >
      <Text allowFontScaling accessibilityElementsHidden importantForAccessibility="no" style={{ fontSize: 16 }}>🚨</Text>
      <Text allowFontScaling style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14, marginLeft: 4 }}>
        {t('emergency.title')}
      </Text>
    </Pressable>
  );
}

export default function RootNavigator() {
  const { theme, ready, isAuthed, assistiveTech } = useContext(AppContext);
  const { t } = useTranslation();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const initialRoute = !isAuthed ? 'Language' : !assistiveTech ? 'AccessibilitySetup' : 'Home';

  // Screens that show the persistent emergency header button (signed-in area,
  // excluding the Emergency screen itself and pre-auth/setup flows).
  const withEmergency = (title) => ({ navigation }) => ({
    title,
    headerRight: () => <EmergencyHeaderButton navigation={navigation} />,
  });

  const headerStyle = {
    headerStyle: { backgroundColor: theme.colors.bg },
    headerTintColor: theme.colors.text,
    headerTitleStyle: { color: theme.colors.text },
  };

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={headerStyle}>
        <Stack.Screen name="Language" component={LanguageSelectScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AccessibilitySetup" component={AccessibilitySetupScreen} options={{ title: t('access.title'), headerBackVisible: false }} />
        <Stack.Screen name="Home" component={HomeScreen} options={({ navigation }) => ({ title: t('app.name'), headerBackVisible: false, headerRight: () => <EmergencyHeaderButton navigation={navigation} /> })} />
        <Stack.Screen name="Symptom" component={SymptomReportScreen} options={withEmergency(t('symptom.title'))} />
        <Stack.Screen name="TriageResult" component={TriageResultScreen} options={withEmergency(t('triage.title'))} />
        <Stack.Screen name="Queue" component={QueueStatusScreen} options={withEmergency(t('queue.title'))} />
        <Stack.Screen name="Appointments" component={AppointmentsScreen} options={withEmergency(t('appointments.title'))} />
        <Stack.Screen name="Caregiver" component={CaregiverProxyScreen} options={withEmergency(t('caregiver.title'))} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={withEmergency(t('settings.title'))} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={withEmergency(t('profile.title'))} />
        <Stack.Screen name="Emergency" component={EmergencyScreen} options={{ title: t('emergency.title'), headerStyle: { backgroundColor: theme.emergency.bg }, headerTintColor: '#FFFFFF', headerTitleStyle: { color: '#FFFFFF' } }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
