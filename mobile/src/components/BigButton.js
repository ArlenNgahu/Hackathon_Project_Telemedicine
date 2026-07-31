import React, { useContext } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { AppContext } from '../context/AppContext';

// The core interactive element. Large-touch by default (target size from the
// active profile), screen-reader complete, and scanner-aware: when `highlighted`
// it draws the accent focus ring so a switch user can see what "select
// highlighted" will pick.
//
// Variants: primary (teal), outline (navy), danger (red), surface (card).
// `critical` overrides the border to the clinical red (used for urgent presets).
export default function BigButton({
  label,
  sublabel,
  onPress,
  variant = 'primary',
  highlighted = false,
  selected = false,
  disabled = false,
  critical = false,
  accessibilityHint,
  accessibilityLabel,
  style,
  minHeight,
  testID,
}) {
  const { theme } = useContext(AppContext);
  const c = theme.colors;

  const palettes = {
    primary: { bg: c.primary, fg: c.white, border: c.primary },
    outline: { bg: c.bg, fg: c.accent, border: c.accent },
    danger: { bg: theme.priority.critical, fg: c.white, border: theme.priority.critical },
    surface: { bg: c.surface, fg: c.text, border: c.border },
  };
  const p = palettes[variant] || palettes.primary;

  const borderColor = critical ? theme.priority.critical : p.border;
  const borderWidth = critical ? 3 : variant === 'outline' ? 2 : 1;

  return (
    <Pressable
      testID={testID}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, selected }}
      hitSlop={theme.hitSlop}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: p.bg,
          borderColor: highlighted ? theme.scan.ringColor : borderColor,
          borderWidth: highlighted ? theme.scan.ringWidth : borderWidth,
          minHeight: minHeight || theme.targetSize,
          borderRadius: theme.radius.md,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        highlighted && styles.highlightedShadow,
        style,
      ]}
    >
      <View style={styles.row}>
        {selected ? (
          <Text
            allowFontScaling
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{ color: p.fg, fontSize: theme.font.body, marginRight: 8 }}
          >
            ✓
          </Text>
        ) : null}
        <View style={{ flexShrink: 1 }}>
          <Text
            allowFontScaling
            style={{
              color: p.fg,
              fontSize: theme.font.body,
              fontWeight: '700',
              textAlign: sublabel ? 'left' : 'center',
            }}
          >
            {label}
          </Text>
          {sublabel ? (
            <Text
              allowFontScaling
              style={{
                color: variant === 'primary' || variant === 'danger' ? c.white : c.textMuted,
                fontSize: theme.font.small,
                marginTop: 2,
                opacity: 0.9,
              }}
            >
              {sublabel}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { justifyContent: 'center', width: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  highlightedShadow: {
    shadowColor: '#1B3F8B',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
