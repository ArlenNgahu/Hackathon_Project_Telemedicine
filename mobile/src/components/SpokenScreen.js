import React, { useContext, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppContext } from '../context/AppContext';
import { useSpeech } from '../hooks/useSpeech';
import { announce } from '../utils/a11y';

// Persistent caregiver-mode banner — visible on EVERY screen while proxy mode is
// active so the caregiver never forgets whose account they are acting in.
function CaregiverBanner() {
  const { theme, caregiver } = useContext(AppContext);
  const { t } = useTranslation();
  if (!caregiver) return null;
  const name = caregiver.patient?.first_name || t('caregiver.selectPatient');
  return (
    <View
      accessibilityRole="alert"
      style={{ backgroundColor: theme.colors.accent, paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md }}
    >
      <Text allowFontScaling style={{ color: '#FFFFFF', fontSize: theme.font.small, fontWeight: '700', textAlign: 'center' }}>
        👥 {t('caregiver.banner', { name })}
      </Text>
    </View>
  );
}

// Wrapper that:
//  - speaks the screen's purpose aloud on mount (spoken path), in the user's
//    language and voice, once per focus.
//  - mirrors the same message to the screen reader live region (announce()),
//    with the iOS post-navigation delay.
//  - provides the standard themed, scrollable, safe-area page shell so layouts
//    survive 200% font scale.
//
// Pass `speech` (string) for what to say. Set `scroll={false}` for screens that
// manage their own scrolling (e.g. a FlatList).
export default function SpokenScreen({
  children,
  speech,
  announceMessage,
  scroll = true,
  backgroundColor,
  contentStyle,
  testID,
}) {
  const { theme } = useContext(AppContext);
  const { speak } = useSpeech();
  const spoken = useRef(false);

  useEffect(() => {
    if (spoken.current) return;
    spoken.current = true;
    if (speech) speak(speech);
    // Screen readers get their own announcement (VoiceOver already reads focus,
    // but this surfaces the purpose/summary that isn't the first focused node).
    announce(announceMessage || speech);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bg = backgroundColor || theme.colors.bg;
  const padding = theme.spacing.lg;

  const inner = (
    <View style={[{ padding, flexGrow: 1 }, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} testID={testID}>
      <CaregiverBanner />
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
          style={{ backgroundColor: bg }}
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
