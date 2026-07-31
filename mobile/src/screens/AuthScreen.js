import React, { useContext, useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppContext } from '../context/AppContext';
import SpokenScreen from '../components/SpokenScreen';
import ScreenHeader from '../components/ScreenHeader';
import FieldInput from '../components/FieldInput';
import BigButton from '../components/BigButton';
import { announce } from '../utils/a11y';

// SCREEN 2 — Auth (login / register). Keyboard-avoiding, live-region errors.
export default function AuthScreen({ navigation }) {
  const { t } = useTranslation();
  const { theme, login, register, assistiveTech } = useContext(AppContext);

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const validate = () => {
    const e = {};
    if (mode === 'register' && !name.trim()) e.name = t('auth.errorName');
    if (!phone || phone.replace(/\D/g, '').length < 9) e.phone = t('auth.errorPhone');
    if (!password || password.length < 4) e.password = t('auth.errorPassword');
    setErrors(e);
    if (Object.keys(e).length) {
      announce(Object.values(e).join('. '));
      return false;
    }
    return true;
  };

  const onSubmit = async () => {
    if (!validate()) return;
    setBusy(true);
    announce(mode === 'login' ? t('auth.signingIn') : t('auth.creating'));
    try {
      let dest;
      if (mode === 'login') {
        const result = await login({ phone, password });
        // Returning patient already has a saved profile → straight Home.
        // Decide from the RESULT, not context state (which updates async and
        // would still be stale in this synchronous handler).
        dest = result?.patient?.primary_assistive_tech || assistiveTech ? 'Home' : 'AccessibilitySetup';
      } else {
        await register({ name, phone, password });
        // New account → let them choose their assistive-tech profile first.
        dest = 'AccessibilitySetup';
      }
      navigation.reset({ index: 0, routes: [{ name: dest }] });
    } catch (err) {
      const msg = t('auth.errorFailed');
      setErrors({ form: msg });
      announce(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SpokenScreen speech={t('auth.spoken')}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader title={mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')} />

        {mode === 'register' ? (
          <FieldInput
            label={t('auth.name')}
            value={name}
            onChangeText={setName}
            placeholder={t('auth.namePlaceholder')}
            error={errors.name}
            autoCapitalize="words"
          />
        ) : null}

        <FieldInput
          label={t('auth.phone')}
          value={phone}
          onChangeText={setPhone}
          placeholder={t('auth.phonePlaceholder')}
          keyboardType="phone-pad"
          error={errors.phone}
          autoCapitalize="none"
        />
        <FieldInput
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          placeholder={t('auth.passwordPlaceholder')}
          secureTextEntry
          error={errors.password}
          autoCapitalize="none"
        />

        {errors.form ? (
          <Text
            accessibilityLiveRegion="assertive"
            accessibilityRole="alert"
            allowFontScaling
            style={{ color: theme.priority.critical, fontSize: theme.font.label, marginBottom: theme.spacing.md }}
          >
            {errors.form}
          </Text>
        ) : null}

        {busy ? (
          <ActivityIndicator size="large" color={theme.colors.primary} accessibilityLabel={t('common.loading')} />
        ) : (
          <BigButton
            label={mode === 'login' ? t('auth.login') : t('auth.register')}
            variant="primary"
            onPress={onSubmit}
            accessibilityHint={mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}
          />
        )}

        <View style={{ marginTop: theme.spacing.md }}>
          <BigButton
            label={mode === 'login' ? t('auth.toRegister') : t('auth.toLogin')}
            variant="surface"
            onPress={() => {
              setErrors({});
              setMode(mode === 'login' ? 'register' : 'login');
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </SpokenScreen>
  );
}
