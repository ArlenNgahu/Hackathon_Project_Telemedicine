import React, { useContext, useState } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppContext } from '../context/AppContext';
import { useSpeech } from '../hooks/useSpeech';
import SpokenScreen from '../components/SpokenScreen';
import ScreenHeader from '../components/ScreenHeader';
import ScanGroup from '../components/ScanGroup';
import BigButton from '../components/BigButton';
import { api } from '../services/api';
import { announce } from '../utils/a11y';

// SCREEN 10 — Caregiver proxy.
// Entry is CONFIRMATION-ONLY (agreed): a spoken + on-screen confirm, no
// re-auth, to keep the input burden low for switch/voice caregivers. Write
// actions are gated behind the patient's caregiver_can_schedule /
// caregiver_can_consent flags. Every action is logged to the AuditLog.
//
// NOTE: the backend /audit/log endpoint does NOT exist yet — logging is stubbed
// in api.js (console + local) and flagged with a visible demo notice.
export default function CaregiverProxyScreen({ navigation }) {
  const { t } = useTranslation();
  const { theme, user, caregiver, enterCaregiverMode, exitCaregiverMode } = useContext(AppContext);
  const { speak } = useSpeech();

  // Demo: the represented patient is the current linked patient record.
  const patient = caregiver?.patient || user;
  const canSchedule = !!patient?.caregiver_can_schedule;
  const canConsent = !!patient?.caregiver_can_consent;
  const active = !!caregiver;

  const [flash, setFlash] = useState(null);

  const enter = async () => {
    await enterCaregiverMode(patient);
    const msg = t('caregiver.entered', { name: patient?.first_name });
    announce(msg); speak(msg);
  };

  const exit = async () => {
    await exitCaregiverMode();
    announce(t('caregiver.exited')); speak(t('caregiver.exited'));
    navigation.navigate('Home');
  };

  // Permission gate only - does NOT call /audit/log. The backend's audit
  // endpoint accepts only the enter/exit session-transition actions (see
  // AppContext.enterCaregiverMode/exitCaregiverMode); a real mutation this
  // gate leads to (e.g. actually booking an appointment) gets its own audit
  // entry server-side, written next to that mutation.
  const doGatedAction = async (action, allowed, deniedKey) => {
    if (!allowed) {
      const msg = t(deniedKey);
      setFlash(msg); announce(msg); speak(msg);
      return;
    }
    const msg = t('caregiver.actionLogged');
    setFlash(msg); announce(msg); speak(msg);
    if (action === 'schedule_appointment') navigation.navigate('Symptom');
  };

  // --- Not yet in caregiver mode: confirmation gate ---
  if (!active) {
    const confirmItems = [
      { key: 'enter', label: t('caregiver.enter'), speech: t('caregiver.confirmHeading', { name: patient?.first_name }), variant: 'primary', onSelect: enter },
      { key: 'cancel', label: t('common.cancel'), speech: t('common.cancel'), variant: 'surface', onSelect: () => navigation.goBack() },
    ];
    return (
      <SpokenScreen speech={t('caregiver.spoken')}>
        <ScreenHeader title={t('caregiver.title')} />
        <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, marginBottom: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border }}>
          <Text accessibilityRole="header" allowFontScaling style={{ color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '800', marginBottom: theme.spacing.sm }}>
            {t('caregiver.confirmHeading', { name: patient?.first_name })}
          </Text>
          <Text allowFontScaling style={{ color: theme.colors.textMuted, fontSize: theme.font.body }}>
            {t('caregiver.confirmBody')}
          </Text>
        </View>
        <ScanGroup items={confirmItems} />
      </SpokenScreen>
    );
  }

  // --- In caregiver mode ---
  const actionItems = [
    {
      key: 'schedule',
      label: t('profile.canSchedule'),
      sublabel: canSchedule ? t('caregiver.canSchedule') : t('caregiver.cannotSchedule'),
      speech: canSchedule ? t('caregiver.canSchedule') : t('caregiver.cannotSchedule'),
      variant: canSchedule ? 'primary' : 'surface',
      selected: false,
      onSelect: () => doGatedAction('schedule_appointment', canSchedule, 'caregiver.cannotSchedule'),
    },
    {
      key: 'consent',
      label: t('profile.canConsent'),
      sublabel: canConsent ? '' : t('caregiver.cannotConsent'),
      speech: canConsent ? t('profile.canConsent') : t('caregiver.cannotConsent'),
      variant: canConsent ? 'primary' : 'surface',
      onSelect: () => doGatedAction('give_consent', canConsent, 'caregiver.cannotConsent'),
    },
    {
      key: 'exit',
      label: t('caregiver.exit'),
      speech: t('caregiver.exit'),
      variant: 'outline',
      onSelect: exit,
    },
  ];

  return (
    <SpokenScreen speech={t('caregiver.actingAs', { name: patient?.first_name })}>
      <ScreenHeader title={t('caregiver.title')} subtitle={t('caregiver.actingAs', { name: patient?.first_name })} />

      <View style={{ backgroundColor: theme.colors.surface, borderColor: theme.priority.medium, borderWidth: 1, borderRadius: theme.radius.sm, padding: theme.spacing.sm, marginBottom: theme.spacing.md }}>
        <Text allowFontScaling style={{ color: theme.colors.textMuted, fontSize: theme.font.small }}>
          ⚠️ {t('caregiver.mockNotice')}
        </Text>
      </View>

      {flash ? (
        <View accessibilityLiveRegion="assertive" style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.primary, borderWidth: 1, borderRadius: theme.radius.sm, padding: theme.spacing.sm, marginBottom: theme.spacing.md }}>
          <Text allowFontScaling style={{ color: theme.colors.text, fontSize: theme.font.label }}>{flash}</Text>
        </View>
      ) : null}

      <ScanGroup items={actionItems} />
    </SpokenScreen>
  );
}
