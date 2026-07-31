import React, { useContext, useEffect, useRef, useState } from 'react';
import { Pressable, Text, Animated, StyleSheet } from 'react-native';
import { AppContext } from '../context/AppContext';
import { STT_AVAILABLE } from '../hooks/useSpeech';
import { useReducedMotion } from '../hooks/useReducedMotion';

// Big microphone button for voice input / commands.
//
// - Large target, screen-reader complete.
// - Pulses while listening — UNLESS Reduce Motion is on, in which case it swaps
//   to a static "listening" state (no animation) per the a11y checklist.
// - STT is feature-gated: if expo-speech-recognition isn't available (Expo Go),
//   pressing it calls onUnavailable() so the screen can open a typed fallback.
export default function VoiceButton({
  label,
  listening = false,
  onPress,
  onUnavailable,
  accessibilityHint,
  size,
}) {
  const { theme } = useContext(AppContext);
  const c = theme.colors;
  const reduceMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(1)).current;
  const [loopRef, setLoopRef] = useState(null);

  const diameter = size || Math.max(theme.targetSize * 1.8, 120);

  useEffect(() => {
    if (listening && !reduceMotion) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.12, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      loop.start();
      setLoopRef(loop);
      return () => loop.stop();
    }
    pulse.setValue(1);
    if (loopRef) loopRef.stop();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, reduceMotion]);

  const handlePress = () => {
    if (!STT_AVAILABLE && onUnavailable) {
      onUnavailable();
      return;
    }
    onPress?.();
  };

  return (
    <Animated.View style={{ transform: [{ scale: reduceMotion ? 1 : pulse }], alignSelf: 'center', alignItems: 'center' }}>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ busy: listening }}
        hitSlop={theme.hitSlop}
        style={{
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          backgroundColor: listening ? theme.priority.high : c.primary,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 4,
          borderColor: listening ? theme.priority.high : c.accent,
        }}
      >
        {/* Icon only inside the circle; the caption sits below so it never
            clips the button (found while running the app). */}
        <Text
          allowFontScaling
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{ fontSize: diameter * 0.4 }}
        >
          🎤
        </Text>
      </Pressable>
      <Text
        allowFontScaling
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={{ color: c.text, fontSize: theme.font.label, fontWeight: '700', marginTop: theme.spacing.sm, textAlign: 'center', maxWidth: diameter * 2.4 }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({});
