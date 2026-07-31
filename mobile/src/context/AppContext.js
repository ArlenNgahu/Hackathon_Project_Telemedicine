// Single global store for AfyaConnect (no Redux — one React Context).
//
// Owns: language, auth token (SecureStore), patient profile (AsyncStorage),
// assistive-tech profile + user tuning overrides, the derived accessibility
// theme, and caregiver-proxy mode.

import React, { createContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import i18n from '../i18n';
import { getAccessibilityTheme } from '../theme/accessibility';
import { api, setAuthToken } from '../services/api';

export const AppContext = createContext(null);

const KEYS = {
  token: 'afya.token', // SecureStore
  profile: 'afya.profile', // AsyncStorage (JSON)
  lang: 'afya.lang',
  assistiveTech: 'afya.assistiveTech',
  prefs: 'afya.prefs',
};

const DEFAULT_PREFS = {
  scanSpeedMs: null, // null → use profile default from theme
  fontScaleMul: 1,
  dwellMs: null,
  highContrast: false,
};

export function AppProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [lang, setLangState] = useState('en');
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [assistiveTech, setAssistiveTechState] = useState(null); // null until chosen
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);

  // Caregiver proxy mode: { patient } when active, null otherwise.
  const [caregiver, setCaregiver] = useState(null);

  // --- Hydrate persisted state on boot ---
  useEffect(() => {
    (async () => {
      try {
        const [savedToken, savedProfile, savedLang, savedTech, savedPrefs] =
          await Promise.all([
            SecureStore.getItemAsync(KEYS.token).catch(() => null),
            AsyncStorage.getItem(KEYS.profile),
            AsyncStorage.getItem(KEYS.lang),
            AsyncStorage.getItem(KEYS.assistiveTech),
            AsyncStorage.getItem(KEYS.prefs),
          ]);
        if (savedLang) {
          setLangState(savedLang);
          i18n.changeLanguage(savedLang);
        }
        if (savedToken) {
          setToken(savedToken);
          setAuthToken(savedToken); // so authed API calls carry it after a restart
        }
        if (savedProfile) setUser(JSON.parse(savedProfile));
        if (savedTech) setAssistiveTechState(savedTech);
        if (savedPrefs) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(savedPrefs) });
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // --- Language ---
  const setLang = useCallback(async (next) => {
    setLangState(next);
    await i18n.changeLanguage(next);
    await AsyncStorage.setItem(KEYS.lang, next);
  }, []);

  // --- Assistive tech profile ---
  const setAssistiveTech = useCallback(async (next) => {
    setAssistiveTechState(next);
    await AsyncStorage.setItem(KEYS.assistiveTech, next);
  }, []);

  // --- Preference overrides (Settings) ---
  const updatePrefs = useCallback(async (patch) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(KEYS.prefs, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // --- Auth ---
  const persistSession = useCallback(async (result) => {
    setToken(result.access_token);
    setAuthToken(result.access_token); // thread token into the API layer
    setUser(result.patient);
    await SecureStore.setItemAsync(KEYS.token, result.access_token).catch(() => {});
    await AsyncStorage.setItem(KEYS.profile, JSON.stringify(result.patient));
  }, []);

  const login = useCallback(
    async (creds) => {
      const result = await api.login(creds);
      await persistSession(result);
      // Adopt the patient's saved profile/language if we don't have one yet.
      if (result.patient?.preferred_language) {
        await setLang(result.patient.preferred_language);
      }
      if (result.patient?.primary_assistive_tech && !assistiveTech) {
        await setAssistiveTech(result.patient.primary_assistive_tech);
      }
      return result;
    },
    [persistSession, setLang, setAssistiveTech, assistiveTech]
  );

  const register = useCallback(
    async (data) => {
      const result = await api.register({ ...data, preferred_language: lang });
      await persistSession(result);
      return result;
    },
    [persistSession, lang]
  );

  const logout = useCallback(async () => {
    setToken(null);
    setAuthToken(null);
    setUser(null);
    setCaregiver(null);
    await SecureStore.deleteItemAsync(KEYS.token).catch(() => {});
    await AsyncStorage.removeItem(KEYS.profile);
  }, []);

  const updateUser = useCallback(async (patch) => {
    setUser((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(KEYS.profile, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // --- Caregiver proxy ---
  const enterCaregiverMode = useCallback(
    async (patient) => {
      setCaregiver({ patient });
      await api.logCaregiverAction({
        patient_id: patient?.patient_id,
        action: 'enter_caregiver_mode',
      });
    },
    [user]
  );

  const exitCaregiverMode = useCallback(async () => {
    if (caregiver) {
      await api.logCaregiverAction({
        patient_id: caregiver.patient?.patient_id,
        action: 'exit_caregiver_mode',
      });
    }
    setCaregiver(null);
  }, [caregiver, user]);

  // --- Derived theme (single source of truth for sizes/colors) ---
  const theme = useMemo(() => {
    const overrides = {};
    if (prefs.scanSpeedMs) overrides.scanSpeedMs = prefs.scanSpeedMs;
    if (prefs.dwellMs) overrides.dwellMs = prefs.dwellMs;
    if (prefs.fontScaleMul) overrides.fontScaleMul = prefs.fontScaleMul;
    overrides.highContrast = prefs.highContrast;
    return getAccessibilityTheme(assistiveTech || 'none', overrides);
  }, [assistiveTech, prefs]);

  const value = useMemo(
    () => ({
      ready,
      lang,
      setLang,
      token,
      user,
      updateUser,
      assistiveTech,
      setAssistiveTech,
      prefs,
      updatePrefs,
      theme,
      login,
      register,
      logout,
      caregiver,
      enterCaregiverMode,
      exitCaregiverMode,
      isAuthed: !!token,
    }),
    [
      ready, lang, setLang, token, user, updateUser, assistiveTech, setAssistiveTech,
      prefs, updatePrefs, theme, login, register, logout, caregiver,
      enterCaregiverMode, exitCaregiverMode,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
