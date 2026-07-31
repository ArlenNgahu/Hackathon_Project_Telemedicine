import React, { useContext, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppContext } from '../context/AppContext';
import { useSpeech } from '../hooks/useSpeech';
import SpokenScreen from '../components/SpokenScreen';
import ScreenHeader from '../components/ScreenHeader';
import FieldInput from '../components/FieldInput';
import BigButton from '../components/BigButton';
import { announce } from '../utils/a11y';
import { api } from '../services/api';

// SCREEN 12 — Profile. Read-only VIEW first; editing is behind an explicit
// action (so a mis-scan/mis-tap can't silently change medical data). Covers
// personal, medical, caregiver and the home-visit address.
const list = (arr) => (Array.isArray(arr) && arr.length ? arr.join(', ') : null);
const toList = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);

function Row({ label, value, notSet }) {
  const { theme } = useContext(AppContext);
  return (
    <View style={{ marginBottom: theme.spacing.md }}>
      <Text allowFontScaling style={{ color: theme.colors.textMuted, fontSize: theme.font.small }}>{label}</Text>
      <Text allowFontScaling accessibilityLabel={`${label}: ${value || notSet}`} style={{ color: theme.colors.text, fontSize: theme.font.body, fontWeight: '600' }}>
        {value || notSet}
      </Text>
    </View>
  );
}

function Section({ title, children }) {
  const { theme } = useContext(AppContext);
  return (
    <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.md, marginBottom: theme.spacing.md }}>
      <Text accessibilityRole="header" allowFontScaling style={{ color: theme.colors.text, fontSize: theme.font.label, fontWeight: '800', marginBottom: theme.spacing.sm }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { theme, user, updateUser } = useContext(AppContext);
  const { speak } = useSpeech();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const notSet = t('profile.notSet');

  const startEdit = () => {
    setForm({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      phone_primary: user?.phone_primary || '',
      phone_emergency: user?.phone_emergency || '',
      conditions: list(user?.conditions) || '',
      medications: list(user?.medications) || '',
      allergies: list(user?.allergies) || '',
      caregiver_name: user?.caregiver_name || '',
      caregiver_phone: user?.caregiver_phone || '',
      address_line1: user?.address_line1 || '',
      city: user?.city || '',
      region: user?.region || '',
    });
    setEditing(true);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const conditions = toList(form.conditions);
    const medications = toList(form.medications);
    const allergies = toList(form.allergies);
    try {
      // Backend field is chronic_conditions (mobile/UI calls it "conditions");
      // first/last name and phone_primary are identity fields set once at
      // registration and not editable via this endpoint - update them locally
      // only (matches the backend's two-step signup design).
      await api.completeProfile({
        phone_emergency: form.phone_emergency,
        chronic_conditions: conditions,
        medications,
        allergies,
        caregiver_name: form.caregiver_name,
        caregiver_phone: form.caregiver_phone,
        address_line1: form.address_line1,
        city: form.city,
        region: form.region,
      });
      await updateUser({
        first_name: form.first_name,
        last_name: form.last_name,
        phone_primary: form.phone_primary,
        phone_emergency: form.phone_emergency,
        conditions,
        medications,
        allergies,
        caregiver_name: form.caregiver_name,
        caregiver_phone: form.caregiver_phone,
        address_line1: form.address_line1,
        city: form.city,
        region: form.region,
      });
      setEditing(false);
      announce(t('profile.saved')); speak(t('profile.saved'));
    } catch (e) {
      setError(t('common.error'));
      announce(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));

  if (editing && form) {
    return (
      <SpokenScreen speech={t('profile.edit')}>
        <ScreenHeader title={t('profile.edit')} />
        <Section title={t('profile.personal')}>
          <FieldInput label={t('profile.name')} value={form.first_name} onChangeText={set('first_name')} autoCapitalize="words" />
          <FieldInput label={t('profile.phone')} value={form.phone_primary} onChangeText={set('phone_primary')} keyboardType="phone-pad" autoCapitalize="none" />
          <FieldInput label={t('profile.emergencyPhone')} value={form.phone_emergency} onChangeText={set('phone_emergency')} keyboardType="phone-pad" autoCapitalize="none" />
        </Section>
        <Section title={t('profile.medical')}>
          <FieldInput label={t('profile.conditions')} value={form.conditions} onChangeText={set('conditions')} multiline />
          <FieldInput label={t('profile.medications')} value={form.medications} onChangeText={set('medications')} multiline />
          <FieldInput label={t('profile.allergies')} value={form.allergies} onChangeText={set('allergies')} multiline />
        </Section>
        <Section title={t('profile.caregiverInfo')}>
          <FieldInput label={t('profile.caregiverName')} value={form.caregiver_name} onChangeText={set('caregiver_name')} autoCapitalize="words" />
          <FieldInput label={t('profile.caregiverPhone')} value={form.caregiver_phone} onChangeText={set('caregiver_phone')} keyboardType="phone-pad" autoCapitalize="none" />
        </Section>
        <Section title={t('profile.address')}>
          <FieldInput label={t('profile.addressLine')} value={form.address_line1} onChangeText={set('address_line1')} />
          <FieldInput label={t('profile.city')} value={form.city} onChangeText={set('city')} />
          <FieldInput label={t('profile.region')} value={form.region} onChangeText={set('region')} />
        </Section>
        {error ? (
          <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" allowFontScaling
            style={{ color: theme.priority.critical, fontSize: theme.font.label, marginBottom: theme.spacing.sm }}>
            {error}
          </Text>
        ) : null}
        {busy ? (
          <ActivityIndicator size="large" color={theme.colors.primary} accessibilityLabel={t('common.loading')} />
        ) : (
          <BigButton label={t('profile.saveChanges')} variant="primary" onPress={save} />
        )}
        <View style={{ height: theme.spacing.sm }} />
        <BigButton label={t('common.cancel')} variant="surface" onPress={() => { setEditing(false); setError(null); }} disabled={busy} />
      </SpokenScreen>
    );
  }

  return (
    <SpokenScreen speech={t('profile.spoken')}>
      <ScreenHeader title={t('profile.title')} />

      <Section title={t('profile.personal')}>
        <Row label={t('profile.name')} value={[user?.first_name, user?.last_name].filter(Boolean).join(' ')} notSet={notSet} />
        <Row label={t('profile.phone')} value={user?.phone_primary} notSet={notSet} />
        <Row label={t('profile.emergencyPhone')} value={user?.phone_emergency} notSet={notSet} />
        <Row label={t('profile.disability')} value={user?.disability_type} notSet={notSet} />
        <Row label={t('profile.assistiveTech')} value={user?.primary_assistive_tech ? t(`access.${user.primary_assistive_tech}`) : null} notSet={notSet} />
      </Section>

      <Section title={t('profile.medical')}>
        <Row label={t('profile.conditions')} value={list(user?.conditions)} notSet={notSet} />
        <Row label={t('profile.medications')} value={list(user?.medications)} notSet={notSet} />
        <Row label={t('profile.allergies')} value={list(user?.allergies)} notSet={notSet} />
      </Section>

      <Section title={t('profile.caregiverInfo')}>
        <Row label={t('profile.caregiverName')} value={user?.caregiver_name} notSet={notSet} />
        <Row label={t('profile.caregiverPhone')} value={user?.caregiver_phone} notSet={notSet} />
        <Row label={t('profile.canSchedule')} value={user?.caregiver_can_schedule ? t('common.yes') : t('common.no')} notSet={notSet} />
        <Row label={t('profile.canConsent')} value={user?.caregiver_can_consent ? t('common.yes') : t('common.no')} notSet={notSet} />
      </Section>

      <Section title={t('profile.address')}>
        <Row label={t('profile.addressLine')} value={user?.address_line1} notSet={notSet} />
        <Row label={t('profile.city')} value={user?.city} notSet={notSet} />
        <Row label={t('profile.region')} value={user?.region} notSet={notSet} />
      </Section>

      <BigButton label={t('profile.edit')} variant="primary" onPress={startEdit} accessibilityHint={t('profile.edit')} />
    </SpokenScreen>
  );
}
