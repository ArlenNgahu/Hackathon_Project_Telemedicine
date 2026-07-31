import React, { useContext } from 'react';
import { View } from 'react-native';
import { AppContext } from '../context/AppContext';
import BigButton from './BigButton';

// Preset symptom picker. Presets are the PRIMARY path for switch/sip-puff users
// who can't type, so:
//  - Scan/sparse profiles get a single full-width column (bigger targets, clean
//    linear scan order). Touch users get a 2-column grid.
//  - Critical-keyword presets carry the clinical red border so urgency reads at
//    a glance (also announced via the "Urgent" tag in the label).
//
// Scanning highlight is driven externally: pass `highlightedKey` (the scanner
// lives on the screen so it can span presets + other controls in one loop).
export default function PresetGrid({
  presets, // [{ key, label, critical }]
  selectedKey,
  onSelect,
  criticalTag,
  highlightedKey,
}) {
  const { theme } = useContext(AppContext);
  const singleColumn = theme.scan.enabled || theme.sparse;

  return (
    <View
      style={{
        flexDirection: singleColumn ? 'column' : 'row',
        flexWrap: singleColumn ? 'nowrap' : 'wrap',
        justifyContent: 'space-between',
      }}
    >
      {presets.map((p) => (
        <View
          key={p.key}
          style={{
            width: singleColumn ? '100%' : '48%',
            marginBottom: theme.spacing.gap,
          }}
        >
          <BigButton
            label={p.label}
            sublabel={p.critical ? criticalTag : undefined}
            variant="surface"
            critical={p.critical}
            selected={selectedKey === p.key}
            highlighted={highlightedKey === p.key}
            onPress={() => onSelect(p.key)}
            accessibilityLabel={p.critical ? `${p.label}. ${criticalTag}` : p.label}
            accessibilityHint={p.critical ? undefined : undefined}
            minHeight={theme.targetSize * 1.2}
          />
        </View>
      ))}
    </View>
  );
}
