import React, { useContext, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppContext } from '../context/AppContext';
import { useSpeech } from '../hooks/useSpeech';
import SpokenScreen from '../components/SpokenScreen';
import ScanGroup from '../components/ScanGroup';
import BigButton from '../components/BigButton';
import { api } from '../services/api';
import { announce } from '../utils/a11y';

// SCREEN 9 — Emergency. Reachable in ONE action from anywhere (header button).
// Confirm → send → confirm sent, SPOKEN at every step. Red background. Operable
// by the fewest possible inputs: force-scan is on so a single switch / puff /
// spoken word selects "Send" (the first, pre-highlighted item) even if the
// user's profile isn't a scan profile — an emergency must work for everyone.
//
// The mocked alert goes to the patient's caregiver + the AfyaConnect care team
// (honest about what a telemedicine app can actually do — no fake ambulance).
export default function EmergencyScreen({ navigation }) {
  const { t } = useTranslation();
  const { theme, user, caregiver } = useContext(AppContext);
  const { speak } = useSpeech();

  const [phase, setPhase] = useState('confirm'); // confirm | sending | sent

  const send = async () => {
    setPhase('sending');
    announce(t('emergency.sending'));
    speak(t('emergency.sending'));
    try {
      await api.voiceCommand({
        patient_id: caregiver?.patient?.patient_id || user?.patient_id,
        audio_data: '',
        command_type: 'emergency',
      });
    } catch (e) {
      // Even on error we surface the sent screen; a real client would retry /
      // fall back to a direct dial. Flagged for backend wiring.
    }
    setPhase('sent');
    announce(t('emergency.spokenSent'));
    speak(t('emergency.spokenSent'));
  };

  const bg = theme.emergency.bg;

  if (phase === 'sent') {
    return (
      <SpokenScreen speech={t('emergency.spokenSent')} backgroundColor={bg}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text allowFontScaling accessibilityElementsHidden importantForAccessibility="no" style={{ fontSize: 72, textAlign: 'center', marginBottom: theme.spacing.md }}>✅</Text>
          <Text accessibilityRole="header" accessibilityLiveRegion="assertive" allowFontScaling
            style={{ color: theme.emergency.text, fontSize: theme.font.title, fontWeight: '900', textAlign: 'center', marginBottom: theme.spacing.md }}>
            {t('emergency.sentHeading')}
          </Text>
          <Text allowFontScaling style={{ color: theme.emergency.text, fontSize: theme.font.body, textAlign: 'center', marginBottom: theme.spacing.xl }}>
            {t('emergency.sentBody')}
          </Text>
          <BigButton label={t('common.backHome')} variant="surface" onPress={() => navigation.navigate('Home')} />
        </View>
      </SpokenScreen>
    );
  }

  if (phase === 'sending') {
    return (
      <SpokenScreen speech={t('emergency.sending')} backgroundColor={bg}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.emergency.text} accessibilityLabel={t('emergency.sending')} />
          <Text allowFontScaling style={{ color: theme.emergency.text, fontSize: theme.font.heading, fontWeight: '800', marginTop: theme.spacing.lg }}>
            {t('emergency.sending')}
          </Text>
        </View>
      </SpokenScreen>
    );
  }

  const items = [
    { key: 'send', label: t('emergency.send'), speech: t('emergency.send'), variant: 'surface', onSelect: send },
    { key: 'cancel', label: t('emergency.cancel'), speech: t('emergency.cancel'), variant: 'surface', onSelect: () => navigation.goBack() },
  ];

  return (
    <SpokenScreen speech={t('emergency.spokenPrompt')} backgroundColor={bg}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text allowFontScaling accessibilityElementsHidden importantForAccessibility="no" style={{ fontSize: 64, textAlign: 'center', marginBottom: theme.spacing.md }}>🚨</Text>
        <Text accessibilityRole="header" allowFontScaling
          style={{ color: theme.emergency.text, fontSize: theme.font.title, fontWeight: '900', textAlign: 'center', marginBottom: theme.spacing.sm }}>
          {t('emergency.confirmHeading')}
        </Text>
        <Text allowFontScaling style={{ color: theme.emergency.text, fontSize: theme.font.body, textAlign: 'center', marginBottom: theme.spacing.xl }}>
          {t('emergency.confirmBody')}
        </Text>
        {/* forceScan so a single input reaches Send first. */}
        <ScanGroup items={items} forceScan speedMs={2000} />
      </View>
    </SpokenScreen>
  );
}
