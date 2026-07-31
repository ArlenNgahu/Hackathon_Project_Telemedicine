import React, { useContext, useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppContext } from '../context/AppContext';
import { useSpeech } from '../hooks/useSpeech';
import SpokenScreen from '../components/SpokenScreen';
import ScreenHeader from '../components/ScreenHeader';
import BigButton from '../components/BigButton';
import ScanGroup from '../components/ScanGroup';
import { api } from '../services/api';
import { announce } from '../utils/a11y';

// SCREEN 7 — Queue status.
// Auto-refreshes the position and announces only MATERIAL changes (per the
// agreed "milestones only" rule): dropping below 5, becoming next (position 1),
// and the teleconsult offer appearing. This avoids screen-reader chatter on
// every single position change.
const POLL_MS = 5000;

export default function QueueStatusScreen({ navigation, route }) {
  const { t } = useTranslation();
  const { theme } = useContext(AppContext);
  const { speak } = useSpeech();

  const [status, setStatus] = useState(route.params?.ticket || null);
  const [accepted, setAccepted] = useState(false);
  const prevPos = useRef(status?.position ?? null);
  const offeredAnnounced = useRef(false);
  const ticketId = route.params?.ticket?.ticket_id;

  const maybeAnnounce = (next) => {
    const prev = prevPos.current;
    const pos = next.position;
    // Milestone: teleconsult offer just appeared.
    if (next.teleconsult_offered && !offeredAnnounced.current) {
      offeredAnnounced.current = true;
      const msg = t('queue.teleconsultBody');
      announce(msg);
      speak(msg);
    }
    if (prev == null) { prevPos.current = pos; return; }
    if (pos !== prev) {
      if (pos === 1) {
        const msg = t('queue.youAreNext');
        announce(msg); speak(msg);
      } else if (pos < 5 && prev >= 5) {
        const msg = t('queue.underFive', { position: pos });
        announce(msg); speak(msg);
      }
      prevPos.current = pos;
    }
  };

  useEffect(() => {
    if (!ticketId) return undefined;
    let mounted = true;
    const poll = async () => {
      try {
        const next = await api.queueStatus({ ticket_id: ticketId });
        if (!mounted) return;
        setStatus(next);
        maybeAnnounce(next);
      } catch (e) {
        // ticket resolved/closed — stop quietly
      }
    };
    const id = setInterval(poll, POLL_MS);
    return () => { mounted = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const acceptTeleconsult = async () => {
    try {
      await api.acceptTeleconsult({ ticket_id: ticketId });
      setAccepted(true);
      announce(t('queue.teleconsultAccepted'));
      speak(t('queue.teleconsultAccepted'));
    } catch (e) {
      announce(t('common.error'));
    }
  };

  if (!status) {
    return (
      <SpokenScreen speech={t('queue.spoken')}>
        <ScreenHeader title={t('queue.title')} />
        <ActivityIndicator size="large" color={theme.colors.primary} accessibilityLabel={t('queue.refreshing')} />
      </SpokenScreen>
    );
  }

  const c = theme.colors;
  const spoken = `${t('queue.spoken')} ${t('queue.positionLabel')} ${status.position} ${t('queue.ofTotal', { total: status.total_waiting })}. ${t('queue.estWait')}: ${t('queue.minutes', { count: status.estimated_wait_minutes })}.`;

  const teleconsultItems = [
    { key: 'accept', label: t('queue.acceptTeleconsult'), speech: t('queue.acceptTeleconsult'), variant: 'primary', onSelect: acceptTeleconsult },
    { key: 'wait', label: t('queue.keepWaiting'), speech: t('queue.keepWaiting'), variant: 'surface', onSelect: () => {} },
  ];

  return (
    <SpokenScreen speech={spoken}>
      <ScreenHeader title={t('queue.title')} />

      {/* Big position number */}
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`${t('queue.positionLabel')} ${status.position} ${t('queue.ofTotal', { total: status.total_waiting })}. ${t('queue.estWait')} ${t('queue.minutes', { count: status.estimated_wait_minutes })}`}
        style={{ backgroundColor: c.surface, borderRadius: theme.radius.lg, padding: theme.spacing.xl, alignItems: 'center', marginBottom: theme.spacing.lg, borderWidth: 1, borderColor: c.border }}
      >
        <Text allowFontScaling style={{ color: c.textMuted, fontSize: theme.font.label }}>{t('queue.positionLabel')}</Text>
        <Text allowFontScaling style={{ color: c.primary, fontSize: theme.font.display * 2, fontWeight: '900', lineHeight: theme.font.display * 2.1 }}>
          {status.position}
        </Text>
        <Text allowFontScaling style={{ color: c.textMuted, fontSize: theme.font.label }}>
          {t('queue.ofTotal', { total: status.total_waiting })}
        </Text>
        <View style={{ height: theme.spacing.md }} />
        <Text allowFontScaling style={{ color: c.text, fontSize: theme.font.label }}>{t('queue.estWait')}</Text>
        <Text allowFontScaling style={{ color: c.text, fontSize: theme.font.title, fontWeight: '800' }}>
          {t('queue.minutes', { count: status.estimated_wait_minutes })}
        </Text>
      </View>

      {accepted ? (
        <View accessibilityLiveRegion="polite" style={{ backgroundColor: c.surface, borderColor: c.primary, borderWidth: 2, borderRadius: theme.radius.md, padding: theme.spacing.lg }}>
          <Text allowFontScaling style={{ color: c.text, fontSize: theme.font.body, fontWeight: '700' }}>
            {t('queue.teleconsultAccepted')}
          </Text>
        </View>
      ) : status.teleconsult_offered ? (
        <View style={{ backgroundColor: c.surface, borderColor: theme.priority.medium, borderWidth: 2, borderRadius: theme.radius.lg, padding: theme.spacing.lg, marginBottom: theme.spacing.md }}>
          <Text accessibilityRole="header" allowFontScaling style={{ color: c.text, fontSize: theme.font.heading, fontWeight: '800', marginBottom: theme.spacing.xs }}>
            {t('queue.teleconsultHeading')}
          </Text>
          <Text allowFontScaling style={{ color: c.text, fontSize: theme.font.body, marginBottom: theme.spacing.md }}>
            {t('queue.teleconsultBody')}
          </Text>
          <ScanGroup items={teleconsultItems} />
        </View>
      ) : (
        <BigButton label={t('common.backHome')} variant="surface" onPress={() => navigation.navigate('Home')} />
      )}
    </SpokenScreen>
  );
}
