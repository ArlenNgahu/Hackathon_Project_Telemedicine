import React, { useContext, useState } from 'react';
import { View, Text, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppContext } from '../context/AppContext';
import { useSpeech } from '../hooks/useSpeech';
import SpokenScreen from '../components/SpokenScreen';
import ScreenHeader from '../components/ScreenHeader';
import ScanGroup from '../components/ScanGroup';
import BigButton from '../components/BigButton';
import VoiceButton from '../components/VoiceButton';
import FieldInput from '../components/FieldInput';
import { matchVoiceCommand } from '../services/voiceCommands';
import { announce } from '../utils/a11y';

// SCREEN 4 — Home. Renders per-mode:
//   voice profile  → big mic + spoken command routing (typed fallback in Expo Go)
//   scan profiles  → auto-scanning list of destinations
//   others         → large-touch list
// Emergency is always one action away (header button, wired in the navigator).
const DESTINATIONS = [
  { key: 'Symptom', tKey: 'reportSymptoms', variant: 'primary' },
  { key: 'Queue', tKey: 'myQueue', variant: 'surface' },
  { key: 'Appointments', tKey: 'appointments', variant: 'surface' },
  { key: 'Caregiver', tKey: 'caregiver', variant: 'surface' },
  { key: 'Profile', tKey: 'profile', variant: 'surface' },
  { key: 'Settings', tKey: 'settings', variant: 'surface' },
];

const INTENT_ROUTE = {
  emergency: 'Emergency',
  symptoms: 'Symptom',
  queue: 'Queue',
  appointments: 'Appointments',
  settings: 'Settings',
  profile: 'Profile',
};

export default function HomeScreen({ navigation }) {
  const { t } = useTranslation();
  const { theme, user, assistiveTech } = useContext(AppContext);
  const { speak, sttAvailable, listening, startListening, stopListening } = useSpeech();

  const [typedOpen, setTypedOpen] = useState(false);
  const [typedCmd, setTypedCmd] = useState('');

  const name = user?.first_name || '';
  const isVoice = assistiveTech === 'voice';

  const route = (intent) => {
    const dest = INTENT_ROUTE[intent];
    if (dest) {
      navigation.navigate(dest);
    } else {
      announce(t('home.notUnderstood'));
      speak(t('home.notUnderstood'));
    }
  };

  const onTypedSubmit = () => {
    setTypedOpen(false);
    const intent = matchVoiceCommand(typedCmd);
    setTypedCmd('');
    route(intent);
  };

  const onMicPress = () => {
    if (listening) {
      stopListening();
      return;
    }
    startListening(
      (transcript) => {
        const intent = matchVoiceCommand(transcript);
        route(intent);
      },
      { onError: () => setTypedOpen(true) }
    );
  };

  const items = DESTINATIONS.map((d) => ({
    key: d.key,
    label: t(`home.${d.tKey}`),
    sublabel: t(`home.${d.tKey}Hint`),
    speech: `${t(`home.${d.tKey}`)}. ${t(`home.${d.tKey}Hint`)}`,
    variant: d.variant,
    hint: t(`home.${d.tKey}Hint`),
    onSelect: () => navigation.navigate(d.key),
  }));

  return (
    <SpokenScreen speech={isVoice ? t('home.spokenVoice') : t('home.spoken')}>
      <ScreenHeader title={t('home.greeting', { name })} subtitle={t('app.tagline')} />

      {isVoice ? (
        <View style={{ alignItems: 'center', marginVertical: theme.spacing.lg }}>
          <VoiceButton
            label={listening ? t('home.listening') : t('home.tapToSpeak')}
            listening={listening}
            onPress={onMicPress}
            onUnavailable={() => setTypedOpen(true)}
            accessibilityHint={t('home.spokenVoice')}
          />
          <Text
            allowFontScaling
            style={{ color: theme.colors.textMuted, fontSize: theme.font.label, textAlign: 'center', marginTop: theme.spacing.md }}
          >
            {t('home.spokenVoice')}
          </Text>
          {/* Voice users still get the full list below as a reliable fallback. */}
          <View style={{ height: theme.spacing.lg }} />
        </View>
      ) : null}

      <ScanGroup items={items} />

      {/* Typed-command fallback modal (Expo Go / STT unavailable). */}
      <Modal
        visible={typedOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTypedOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(10,31,61,0.45)', justifyContent: 'center', padding: theme.spacing.lg }}>
          <View
            accessibilityViewIsModal
            style={{ backgroundColor: theme.colors.bg, borderRadius: theme.radius.lg, padding: theme.spacing.lg }}
          >
            <Text accessibilityRole="header" allowFontScaling style={{ color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '800', marginBottom: theme.spacing.sm }}>
              {t('home.tapToSpeak')}
            </Text>
            {!sttAvailable ? (
              <Text allowFontScaling style={{ color: theme.colors.textMuted, fontSize: theme.font.small, marginBottom: theme.spacing.md }}>
                {t('a11y.sttUnavailable')}
              </Text>
            ) : null}
            <FieldInput
              label={t('home.tapToSpeak')}
              value={typedCmd}
              onChangeText={setTypedCmd}
              placeholder={t('home.reportSymptoms')}
              autoCapitalize="none"
            />
            <BigButton label={t('common.confirm')} variant="primary" onPress={onTypedSubmit} />
            <View style={{ height: theme.spacing.sm }} />
            <BigButton label={t('common.cancel')} variant="surface" onPress={() => setTypedOpen(false)} />
          </View>
        </View>
      </Modal>
    </SpokenScreen>
  );
}
