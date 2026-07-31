import React, { useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppContext } from '../context/AppContext';

// A screen title exposed to assistive tech as a heading (accessibilityRole="header"),
// with an optional subtitle. Font sizes come from theme; text is font-scalable.
export default function ScreenHeader({ title, subtitle }) {
  const { theme } = useContext(AppContext);
  const c = theme.colors;
  return (
    <View style={[styles.wrap, { marginBottom: theme.spacing.md }]}>
      <Text
        accessibilityRole="header"
        allowFontScaling
        style={{ color: c.text, fontSize: theme.font.title, fontWeight: '800' }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          allowFontScaling
          style={{
            color: c.textMuted,
            fontSize: theme.font.label,
            marginTop: theme.spacing.xs,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
});
