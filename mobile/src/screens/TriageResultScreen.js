import React, { useContext, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppContext } from '../context/AppContext';
import { useSpeech } from '../hooks/useSpeech';
import SpokenScreen from '../components/SpokenScreen';
import ScreenHeader from '../components/ScreenHeader';
import PriorityCard from '../components/PriorityCard';
import ScanGroup from '../components/ScanGroup';
import { api } from '../services/api';
import { announce } from '../utils/a11y';

// SCREEN 6 — Triage result. The priority, reasoning and recommended action are
// spoken aloud on arrival (voice/blind users must hear the outcome, not hunt for
// it). Colors are the clinical severity convention via PriorityCard.
export default function TriageResultScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { theme, user, caregiver } = useContext(AppContext);
  const { speak } = useSpeech();
  const triage = route.params?.triage || {};
  const priority = triage.priority || 'medium';
  const [busy, setBusy] = useState(false);

  const priorityLabel = t(`triage.priority.${priority}`);
  const confidencePct = Math.round((triage.confidence || 0) * 100);
  // Raw backend codes (e.g. "immediate_hospital") mapped to human copy; mock
  // mode already returns a human sentence, which just passes through as the
  // defaultValue since it won't match any triage.action.* key.
  const actionText = t(`triage.action.${triage.recommended_action}`, {
    defaultValue: triage.recommended_action || '',
  });

  // Full spoken summary for the screen's spoken path.
  const spoken = [
    t('triage.spokenPrefix'),
    `${t('triage.priorityLabel')}: ${priorityLabel}.`,
    triage.reasoning || '',
    t('triage.spokenAction', { action: actionText }),
  ].join(' ');

  const joinQueue = async () => {
    setBusy(true);
    announce(t('queue.refreshing'));
    try {
      const patientId = caregiver?.patient?.patient_id || user?.patient_id;
      const patientName = caregiver?.patient?.first_name || user?.first_name || 'Patient';
      const res = await api.joinQueue({
        patient_id: patientId,
        patient_name: patientName,
        priority,
        is_pwd: true,
      });
      navigation.navigate('Queue', { ticket: res });
    } catch (e) {
      announce(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  // Suggests the lightest-touch appointment type that fits the recommended
  // action. The patient/caregiver isn't asked to pick - this is a fast path
  // off a triage result, not a full booking flow.
  const suggestedApptType = (action) => {
    if (action === 'teleconsult_priority' || action === 'teleconsult_or_scheduled_visit') return 'teleconsult';
    if (action === 'home_visit_priority') return 'home_visit';
    if (['immediate_hospital', 'hospital_or_home_visit', 'hospital_or_teleconsult'].includes(action)) return 'hospital';
    return 'teleconsult';
  };

  const bookAppointment = async () => {
    setBusy(true);
    announce(t('triage.booking'));
    try {
      const patientId = caregiver?.patient?.patient_id || user?.patient_id;
      await api.createAppointment({
        patient_id: patientId,
        triage_id: triage.triage_id,
        appointment_type: suggestedApptType(triage.recommended_action),
        acting_as_caregiver: !!caregiver,
      });
      announce(t('triage.booked'));
      speak(t('triage.booked'));
      navigation.navigate('Appointments');
    } catch (e) {
      // The backend gates caregiver-proxy booking behind caregiver_can_schedule
      // and returns 403 when this caregiver isn't authorized - give that its
      // own message instead of a generic error.
      const msg = e?.status === 403 ? t('triage.bookNeedsCaregiverPermission') : t('triage.bookFailed');
      announce(msg);
      speak(msg);
    } finally {
      setBusy(false);
    }
  };

  const items = [
    {
      key: 'join',
      label: t('triage.joinQueue'),
      speech: t('triage.joinQueue'),
      variant: 'primary',
      hint: t('triage.joinQueueHint'),
      onSelect: joinQueue,
    },
    ...(triage.triage_id
      ? [{
          key: 'book',
          label: t('triage.bookAppointment'),
          speech: t('triage.bookAppointment'),
          variant: 'outline',
          hint: t('triage.bookAppointmentHint'),
          onSelect: bookAppointment,
        }]
      : []),
    {
      key: 'home',
      label: t('common.backHome'),
      speech: t('common.backHome'),
      variant: 'surface',
      onSelect: () => navigation.navigate('Home'),
    },
  ];

  return (
    <SpokenScreen speech={spoken}>
      <ScreenHeader title={t('triage.title')} />

      <PriorityCard
        priority={priority}
        priorityLabel={priorityLabel}
        summary={t('triage.priorityLabel')}
        confidenceText={t('triage.confidence', { pct: confidencePct })}
      />

      <Text accessibilityRole="header" allowFontScaling style={{ color: theme.colors.text, fontSize: theme.font.label, fontWeight: '800', marginBottom: theme.spacing.xs }}>
        {t('triage.reasoningHeading')}
      </Text>
      <Text allowFontScaling style={{ color: theme.colors.text, fontSize: theme.font.body, marginBottom: theme.spacing.md }}>
        {triage.reasoning}
      </Text>

      <Text accessibilityRole="header" allowFontScaling style={{ color: theme.colors.text, fontSize: theme.font.label, fontWeight: '800', marginBottom: theme.spacing.xs }}>
        {t('triage.actionHeading')}
      </Text>
      <Text allowFontScaling style={{ color: theme.colors.text, fontSize: theme.font.body, marginBottom: theme.spacing.lg }}>
        {actionText}
      </Text>

      {busy ? (
        <ActivityIndicator size="large" color={theme.colors.primary} accessibilityLabel={t('common.loading')} />
      ) : (
        <ScanGroup items={items} />
      )}
    </SpokenScreen>
  );
}
