import React, { useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AppContext } from '../context/AppContext';
import BigButton from './BigButton';

const TYPE_ICON = { teleconsult: '📹', hospital: '🏥', home_visit: '🏠' };

// One upcoming appointment: type, provider, human time, and a primary action
// (Join for joinable teleconsults, else Details). Highlight-aware for scanning.
export default function AppointmentCard({
  typeLabel,
  type,
  provider,
  whenText,
  joinable,
  joinLabel,
  detailsLabel,
  onAction,
  actionHint,
  highlighted = false,
}) {
  const { theme } = useContext(AppContext);
  const c = theme.colors;

  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderRadius: theme.radius.md,
        borderWidth: highlighted ? theme.scan.ringWidth : 1,
        borderColor: highlighted ? theme.scan.ringColor : c.border,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.gap,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.xs }}>
        <Text allowFontScaling accessibilityElementsHidden importantForAccessibility="no" style={{ fontSize: theme.font.heading, marginRight: 8 }}>
          {TYPE_ICON[type] || '📅'}
        </Text>
        <Text allowFontScaling style={{ color: c.text, fontSize: theme.font.body, fontWeight: '800', flexShrink: 1 }}>
          {typeLabel}
        </Text>
      </View>
      <Text allowFontScaling style={{ color: c.text, fontSize: theme.font.label, marginBottom: 2 }}>
        {provider}
      </Text>
      <Text allowFontScaling style={{ color: c.textMuted, fontSize: theme.font.label, marginBottom: theme.spacing.md }}>
        {whenText}
      </Text>
      <BigButton
        label={joinable ? joinLabel : detailsLabel}
        variant={joinable ? 'primary' : 'outline'}
        onPress={onAction}
        highlighted={highlighted}
        accessibilityLabel={`${joinable ? joinLabel : detailsLabel}. ${typeLabel}. ${whenText}`}
        accessibilityHint={actionHint}
      />
    </View>
  );
}

const styles = StyleSheet.create({});
