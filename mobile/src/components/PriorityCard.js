import React, { useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppContext } from '../context/AppContext';

// Big color-coded triage priority card. Uses the CLINICAL severity colors from
// theme.priority (never brand colors). White text sits on the color band for
// contrast. The whole card is exposed to screen readers as a single summary.
export default function PriorityCard({ priority, priorityLabel, summary, confidenceText }) {
  const { theme } = useContext(AppContext);
  const c = theme.colors;
  const color = theme.priority[priority] || theme.priority.medium;

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${priorityLabel}. ${summary || ''} ${confidenceText || ''}`}
      style={{
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: color,
        marginBottom: theme.spacing.lg,
      }}
    >
      <View style={{ backgroundColor: color, padding: theme.spacing.lg }}>
        <Text
          allowFontScaling
          style={{ color: '#FFFFFF', fontSize: theme.font.small, fontWeight: '700', letterSpacing: 1 }}
        >
          {(summary || '').toUpperCase()}
        </Text>
        <Text
          allowFontScaling
          style={{ color: '#FFFFFF', fontSize: theme.font.display, fontWeight: '900', marginTop: 4 }}
        >
          {priorityLabel}
        </Text>
      </View>
      {confidenceText ? (
        <View style={{ backgroundColor: c.surface, padding: theme.spacing.md }}>
          <Text allowFontScaling style={{ color: c.textMuted, fontSize: theme.font.small }}>
            {confidenceText}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({});
