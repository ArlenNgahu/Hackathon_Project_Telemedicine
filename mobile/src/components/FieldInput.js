import React, { useContext } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { AppContext } from '../context/AppContext';

// Labelled text input with an associated live-region error message.
// The label is a real label (accessibilityLabel), the error is announced via a
// role="alert" live region so screen readers speak it when it appears.
export default function FieldInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType,
  secureTextEntry,
  autoCapitalize = 'sentences',
  multiline = false,
  accessibilityHint,
  highlighted = false,
  testID,
}) {
  const { theme } = useContext(AppContext);
  const c = theme.colors;

  return (
    <View style={{ marginBottom: theme.spacing.md }}>
      <Text
        allowFontScaling
        style={{
          color: c.text,
          fontSize: theme.font.label,
          fontWeight: '700',
          marginBottom: theme.spacing.xs,
        }}
      >
        {label}
      </Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        allowFontScaling
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        style={{
          color: c.text,
          fontSize: theme.font.body,
          backgroundColor: c.surface,
          borderColor: error ? theme.priority.critical : highlighted ? theme.scan.ringColor : c.border,
          borderWidth: highlighted ? theme.scan.ringWidth : error ? 2 : 1,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.md,
          minHeight: multiline ? theme.targetSize * 1.6 : theme.targetSize,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
      {error ? (
        <Text
          accessibilityLiveRegion="assertive"
          accessibilityRole="alert"
          allowFontScaling
          style={{ color: theme.priority.critical, fontSize: theme.font.small, marginTop: theme.spacing.xs }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({});
