import React, { useContext, useState, useCallback } from 'react';
import { View, Text, Modal, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppContext } from '../context/AppContext';
import { useSpeech } from '../hooks/useSpeech';
import { useScanner } from '../hooks/useScanner';
import SpokenScreen from '../components/SpokenScreen';
import ScreenHeader from '../components/ScreenHeader';
import PresetGrid from '../components/PresetGrid';
import BigButton from '../components/BigButton';
import VoiceButton from '../components/VoiceButton';
import FieldInput from '../components/FieldInput';
import { api } from '../services/api';
import { announce } from '../utils/a11y';

// SCREEN 5 — Symptom report.
// Presets are the PRIMARY path for switch/sip-puff users (no typing needed).
// Critical-keyword presets carry the clinical red border. Also: voice input
// (typed fallback in Expo Go) and a free-text describe box.
//
// One scanner spans EVERYTHING actionable (each preset, then voice, describe,
// submit) so a one-switch user can reach every control in a single loop.
const PRESETS = [
  { key: 'chest_pain', critical: true, text: 'chest pain' },
  { key: 'headache_sweating', critical: true, text: 'bad headache with sweating' }, // AD signal
  { key: 'breathing', critical: true, text: 'difficulty breathing' },
  { key: 'fever', critical: false, text: 'fever' },
  { key: 'bladder', critical: false, text: 'bladder or catheter problem' },
  { key: 'pressure_sore', critical: false, text: 'pressure sore' },
];

export default function SymptomReportScreen({ navigation }) {
  const { t } = useTranslation();
  const { theme, user, caregiver, lang } = useContext(AppContext);
  const { speak, sttAvailable, listening, startListening, stopListening } = useSpeech();

  const [selectedKey, setSelectedKey] = useState(null);
  const [describe, setDescribe] = useState('');
  const [busy, setBusy] = useState(false);
  const [typedOpen, setTypedOpen] = useState(false);
  const [error, setError] = useState(null);

  // The ordered, scannable control list: presets, then voice, describe, submit.
  const scanKeys = [...PRESETS.map((p) => `preset:${p.key}`), 'voice', 'submit'];

  const speakIndex = useCallback(
    (i) => {
      const key = scanKeys[i];
      if (!key) return;
      if (key.startsWith('preset:')) {
        const pk = key.split(':')[1];
        const p = PRESETS.find((x) => x.key === pk);
        speak(`${t(`symptom.presets.${pk}`)}${p.critical ? '. ' + t('symptom.criticalTag') : ''}`);
      } else if (key === 'voice') speak(t('symptom.voiceButton'));
      else if (key === 'submit') speak(t('symptom.submit'));
    },
    [scanKeys, speak, t]
  );

  const { index, active } = useScanner({
    itemCount: scanKeys.length,
    enabled: theme.scan.enabled,
    speedMs: theme.scan.speedMs,
    onSpeakItem: speakIndex,
  });

  const highlightedKey = active ? scanKeys[index] : null;
  const highlightedPreset =
    highlightedKey && highlightedKey.startsWith('preset:') ? highlightedKey.split(':')[1] : null;

  const selectPreset = (key) => {
    setSelectedKey(key);
    setError(null);
    const label = t(`symptom.presets.${key}`);
    announce(t('symptom.selected', { symptom: label }));
    speak(t('symptom.selected', { symptom: label }));
  };

  // Returns { text, language }. The two paths carry different languages, and
  // the backend needs to be told which explicitly: it otherwise falls back to
  // the patient's SAVED preferred_language, which can silently mis-triage a
  // critical report if that doesn't match the text actually sent (e.g. every
  // preset always sends English clinical text, regardless of app language).
  const buildSymptomReport = () => {
    if (describe.trim().length >= 10) {
      // Free text: the patient typed in whatever language the app UI is
      // currently showing them.
      return { text: describe.trim(), language: lang };
    }
    if (selectedKey) {
      const preset = PRESETS.find((p) => p.key === selectedKey);
      // Presets always send the clinical English keyword string (matches
      // backend keyword sets); the localized label is only for display.
      return { text: `Patient reports ${preset.text}.`, language: 'en' };
    }
    return { text: '', language: 'en' };
  };

  const submit = async () => {
    const { text: symptoms_text, language } = buildSymptomReport();
    if (!symptoms_text) {
      setError(t('symptom.chooseOne'));
      announce(t('symptom.chooseOne'));
      return;
    }
    setBusy(true);
    announce(t('symptom.submitting'));
    try {
      const result = await api.reportSymptoms({
        patient_id: caregiver?.patient?.patient_id || user?.patient_id,
        symptoms_text,
        language,
      });
      navigation.navigate('TriageResult', { triage: result });
    } catch (e) {
      setError(t('common.error'));
      announce(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  // "Select highlighted" for the single-switch path.
  const selectHighlighted = () => {
    const key = scanKeys[index];
    if (!key) return;
    if (key.startsWith('preset:')) selectPreset(key.split(':')[1]);
    else if (key === 'voice') openVoice();
    else if (key === 'submit') submit();
  };

  const openVoice = () => {
    if (listening) {
      stopListening();
      return;
    }
    startListening(
      (transcript) => {
        setDescribe(transcript);
        setError(null);
        announce(t('symptom.selected', { symptom: transcript }));
      },
      { onError: () => setTypedOpen(true) }
    );
  };

  return (
    <SpokenScreen speech={t('symptom.spoken')}>
      <ScreenHeader title={t('symptom.title')} subtitle={t('symptom.presetsHeading')} />

      <PresetGrid
        presets={PRESETS.map((p) => ({ key: p.key, label: t(`symptom.presets.${p.key}`), critical: p.critical }))}
        selectedKey={selectedKey}
        onSelect={selectPreset}
        criticalTag={t('symptom.criticalTag')}
        highlightedKey={highlightedPreset}
      />

      <View style={{ height: theme.spacing.md }} />

      {/* Voice input (with typed fallback) */}
      <View style={{ alignItems: 'center', marginBottom: theme.spacing.md }}>
        <VoiceButton
          label={listening ? t('symptom.listening') : t('symptom.voiceButton')}
          listening={listening}
          onPress={openVoice}
          onUnavailable={openVoice}
          size={theme.targetSize * 1.6}
          accessibilityHint={t('symptom.describeHeading')}
        />
      </View>

      {/* Free-text describe. FieldInput renders the label itself, so no separate
          header here (that produced a duplicate label — found while running). */}
      <FieldInput
        label={t('symptom.describeHeading')}
        value={describe}
        onChangeText={(v) => { setDescribe(v); setError(null); }}
        placeholder={t('symptom.placeholder')}
        multiline
        highlighted={highlightedKey === 'describe'}
      />

      {error ? (
        <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" allowFontScaling
          style={{ color: theme.priority.critical, fontSize: theme.font.label, marginBottom: theme.spacing.sm }}>
          {error}
        </Text>
      ) : null}

      {busy ? (
        <ActivityIndicator size="large" color={theme.colors.primary} accessibilityLabel={t('symptom.submitting')} />
      ) : (
        <BigButton
          label={t('symptom.submit')}
          variant="primary"
          onPress={submit}
          highlighted={highlightedKey === 'submit'}
          accessibilityHint={t('symptom.submit')}
        />
      )}

      {/* Single-switch selector */}
      {active ? (
        <View style={{ marginTop: theme.spacing.md }}>
          <BigButton label={t('common.selectHighlighted')} variant="outline" onPress={selectHighlighted} testID="select-highlighted" />
        </View>
      ) : null}

      {/* Typed fallback for voice */}
      <Modal visible={typedOpen} transparent animationType="fade" onRequestClose={() => setTypedOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(10,31,61,0.45)', justifyContent: 'center', padding: theme.spacing.lg }}>
          <View accessibilityViewIsModal style={{ backgroundColor: theme.colors.bg, borderRadius: theme.radius.lg, padding: theme.spacing.lg }}>
            <Text accessibilityRole="header" allowFontScaling style={{ color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '800', marginBottom: theme.spacing.sm }}>
              {t('symptom.voiceButton')}
            </Text>
            {!sttAvailable ? (
              <Text allowFontScaling style={{ color: theme.colors.textMuted, fontSize: theme.font.small, marginBottom: theme.spacing.md }}>
                {t('a11y.sttUnavailable')}
              </Text>
            ) : null}
            <FieldInput label={t('symptom.describeHeading')} value={describe} onChangeText={setDescribe} placeholder={t('symptom.placeholder')} multiline />
            <BigButton label={t('common.confirm')} variant="primary" onPress={() => setTypedOpen(false)} />
            <View style={{ height: theme.spacing.sm }} />
            <BigButton label={t('common.cancel')} variant="surface" onPress={() => setTypedOpen(false)} />
          </View>
        </View>
      </Modal>
    </SpokenScreen>
  );
}
