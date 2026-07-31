import React, { useContext, useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppContext } from '../context/AppContext';
import { useSpeech } from '../hooks/useSpeech';
import { useScanner } from '../hooks/useScanner';
import SpokenScreen from '../components/SpokenScreen';
import ScreenHeader from '../components/ScreenHeader';
import AppointmentCard from '../components/AppointmentCard';
import BigButton from '../components/BigButton';
import { api } from '../services/api';
import { announce } from '../utils/a11y';

// SCREEN 8 — Appointments. Reads real bookings via GET /appointments when
// USE_MOCK is false (api.js falls back to fixtures, flagged with a visible
// demo notice, otherwise). Empty state is an invitation (offers "report
// symptoms"), not an apology.
function formatWhen(iso, lang) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(lang === 'sw' ? 'sw-KE' : 'en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function AppointmentsScreen({ navigation }) {
  const { t } = useTranslation();
  const { theme, user, lang } = useContext(AppContext);
  const { speak } = useSpeech();

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [isMock, setIsMock] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.appointments({ patient_id: user?.patient_id });
        if (!mounted) return;
        setList(res.appointments || []);
        setIsMock(!!res._mock);
      } catch (e) {
        if (mounted) setList([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  const speakIndex = useCallback(
    (i) => {
      const a = list[i];
      if (a) speak(`${t(`appointments.type.${a.type}`)}. ${a.provider}. ${formatWhen(a.starts_at, lang)}`);
    },
    [list, speak, t, lang]
  );

  const { index, active } = useScanner({
    itemCount: list.length,
    enabled: theme.scan.enabled,
    speedMs: theme.scan.speedMs,
    onSpeakItem: speakIndex,
  });

  const onCardAction = (a) => {
    // Join / details are demo-only for now (no live video backend).
    announce(a.joinable ? t('appointments.join') : t('appointments.details'));
  };

  if (loading) {
    return (
      <SpokenScreen speech={t('appointments.spoken')}>
        <ScreenHeader title={t('appointments.title')} />
        <ActivityIndicator size="large" color={theme.colors.primary} accessibilityLabel={t('common.loading')} />
      </SpokenScreen>
    );
  }

  return (
    <SpokenScreen speech={list.length ? t('appointments.spoken') : t('appointments.emptyBody')}>
      <ScreenHeader title={t('appointments.title')} />

      {isMock ? (
        <View style={{ backgroundColor: theme.colors.surface, borderColor: theme.priority.medium, borderWidth: 1, borderRadius: theme.radius.sm, padding: theme.spacing.sm, marginBottom: theme.spacing.md }}>
          <Text allowFontScaling style={{ color: theme.colors.textMuted, fontSize: theme.font.small }}>
            ⚠️ {t('appointments.mockNotice')}
          </Text>
        </View>
      ) : null}

      {list.length === 0 ? (
        // Empty state: an invitation, not an apology.
        <View style={{ alignItems: 'center', paddingVertical: theme.spacing.xl }}>
          <Text allowFontScaling accessibilityElementsHidden importantForAccessibility="no" style={{ fontSize: 56, marginBottom: theme.spacing.md }}>🗓️</Text>
          <Text accessibilityRole="header" allowFontScaling style={{ color: theme.colors.text, fontSize: theme.font.heading, fontWeight: '800', textAlign: 'center', marginBottom: theme.spacing.sm }}>
            {t('appointments.emptyHeading')}
          </Text>
          <Text allowFontScaling style={{ color: theme.colors.textMuted, fontSize: theme.font.body, textAlign: 'center', marginBottom: theme.spacing.lg }}>
            {t('appointments.emptyBody')}
          </Text>
          <BigButton label={t('appointments.emptyAction')} variant="primary" onPress={() => navigation.navigate('Symptom')} accessibilityHint={t('home.reportSymptomsHint')} />
        </View>
      ) : (
        <View>
          {list.map((a, i) => (
            <AppointmentCard
              key={a.id}
              type={a.type}
              typeLabel={t(`appointments.type.${a.type}`)}
              provider={a.provider}
              whenText={formatWhen(a.starts_at, lang)}
              joinable={a.joinable}
              joinLabel={t('appointments.join')}
              detailsLabel={t('appointments.details')}
              actionHint={a.joinable ? t('appointments.joinHint') : t('appointments.detailsHint')}
              onAction={() => onCardAction(a)}
              highlighted={active && index === i}
            />
          ))}
          {active ? (
            <BigButton
              label={t('common.selectHighlighted')}
              variant="outline"
              onPress={() => onCardAction(list[index])}
              testID="select-highlighted"
            />
          ) : null}
        </View>
      )}
    </SpokenScreen>
  );
}
