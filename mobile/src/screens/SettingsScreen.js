import React, { useContext } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppContext } from '../context/AppContext';
import { useSpeech } from '../hooks/useSpeech';
import SpokenScreen from '../components/SpokenScreen';
import ScreenHeader from '../components/ScreenHeader';
import ScanGroup from '../components/ScanGroup';
import { announce } from '../utils/a11y';

// SCREEN 11 — Settings. The screen where a user re-tunes their experience, so it
// must itself be operable in their CURRENT mode: every control is a large button
// in one linear ScanGroup, each with a spoken/announced confirmation on change.
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export default function SettingsScreen({ navigation }) {
  const { t } = useTranslation();
  const { theme, lang, setLang, assistiveTech, prefs, updatePrefs, logout } = useContext(AppContext);
  const { speak } = useSpeech();

  const scanSpeed = prefs.scanSpeedMs || theme.scan.speedMs || 2000;
  const fontMul = prefs.fontScaleMul || 1;
  const dwell = prefs.dwellMs || theme.dwellMs || 1000;

  const confirm = (msg) => { announce(msg); speak(msg); };

  const setScan = (deltaMs) => {
    const next = clamp(scanSpeed + deltaMs, 800, 4000);
    updatePrefs({ scanSpeedMs: next });
    confirm(`${t('settings.scanSpeed')}: ${t('settings.seconds', { n: (next / 1000).toFixed(1) })}`);
  };
  const setFont = (delta) => {
    const next = clamp(Number((fontMul + delta).toFixed(2)), 0.8, 2.0);
    updatePrefs({ fontScaleMul: next });
    confirm(`${t('settings.fontSize')}: ${Math.round(next * 100)}%`);
  };
  const setDwell = (deltaMs) => {
    const next = clamp(dwell + deltaMs, 500, 3000);
    updatePrefs({ dwellMs: next });
    confirm(`${t('settings.dwellTime')}: ${t('settings.seconds', { n: (next / 1000).toFixed(1) })}`);
  };
  const toggleContrast = () => {
    const next = !prefs.highContrast;
    updatePrefs({ highContrast: next });
    confirm(next ? t('settings.highContrastOn') : t('settings.highContrastOff'));
  };
  const chooseLang = (lng) => { setLang(lng); confirm(lng === 'sw' ? 'Kiswahili' : 'English'); };

  const items = [
    { key: 'lang-en', label: `${t('settings.language')}: ${t('language.english')}`, speech: t('language.english'), variant: lang === 'en' ? 'primary' : 'surface', selected: lang === 'en', onSelect: () => chooseLang('en') },
    { key: 'lang-sw', label: `${t('settings.language')}: ${t('language.swahili')}`, speech: t('language.swahili'), variant: lang === 'sw' ? 'primary' : 'surface', selected: lang === 'sw', onSelect: () => chooseLang('sw') },
    { key: 'profile', label: `${t('settings.assistiveTech')}: ${t(`access.${assistiveTech || 'none'}`)}`, sublabel: t('access.hint'), speech: `${t('settings.assistiveTech')}. ${t(`access.${assistiveTech || 'none'}`)}`, variant: 'surface', onSelect: () => navigation.navigate('AccessibilitySetup') },
    { key: 'scan-slower', label: `${t('settings.scanSpeed')} — ${t('settings.slower')}`, sublabel: t('settings.seconds', { n: (scanSpeed / 1000).toFixed(1) }), speech: t('settings.slower'), variant: 'surface', onSelect: () => setScan(200) },
    { key: 'scan-faster', label: `${t('settings.scanSpeed')} — ${t('settings.faster')}`, sublabel: t('settings.seconds', { n: (scanSpeed / 1000).toFixed(1) }), speech: t('settings.faster'), variant: 'surface', onSelect: () => setScan(-200) },
    { key: 'font-smaller', label: `${t('settings.fontSize')} — ${t('settings.smaller')}`, sublabel: `${Math.round(fontMul * 100)}%`, speech: t('settings.smaller'), variant: 'surface', onSelect: () => setFont(-0.1) },
    { key: 'font-larger', label: `${t('settings.fontSize')} — ${t('settings.larger')}`, sublabel: `${Math.round(fontMul * 100)}%`, speech: t('settings.larger'), variant: 'surface', onSelect: () => setFont(0.1) },
    { key: 'dwell-less', label: `${t('settings.dwellTime')} — ${t('settings.faster')}`, sublabel: t('settings.seconds', { n: (dwell / 1000).toFixed(1) }), speech: t('settings.dwellTime'), variant: 'surface', onSelect: () => setDwell(-250) },
    { key: 'dwell-more', label: `${t('settings.dwellTime')} — ${t('settings.slower')}`, sublabel: t('settings.seconds', { n: (dwell / 1000).toFixed(1) }), speech: t('settings.dwellTime'), variant: 'surface', onSelect: () => setDwell(250) },
    { key: 'contrast', label: t('settings.highContrast'), sublabel: prefs.highContrast ? t('settings.highContrastOn') : t('settings.highContrastOff'), speech: t('settings.highContrast'), variant: prefs.highContrast ? 'primary' : 'surface', selected: prefs.highContrast, onSelect: toggleContrast },
    { key: 'logout', label: t('settings.logout'), speech: t('settings.logout'), variant: 'outline', hint: t('settings.logoutHint'), onSelect: async () => { await logout(); navigation.reset({ index: 0, routes: [{ name: 'Language' }] }); } },
  ];

  return (
    <SpokenScreen speech={t('settings.spoken')}>
      <ScreenHeader title={t('settings.title')} />
      <ScanGroup items={items} />
    </SpokenScreen>
  );
}
