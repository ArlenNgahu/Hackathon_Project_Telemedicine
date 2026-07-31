import React, { useContext, useCallback } from 'react';
import { View } from 'react-native';
import { AppContext } from '../context/AppContext';
import { useScanner } from '../hooks/useScanner';
import { useSpeech } from '../hooks/useSpeech';
import BigButton from './BigButton';
import { useTranslation } from 'react-i18next';

// Coordinates the single-input path for a set of choices.
//
// When the active profile enables auto-scan (switch / sip_puff) AND no screen
// reader is running, ScanGroup:
//   - moves a highlight across the items on an interval (speed from theme)
//   - speaks each item as it is highlighted (so eyes aren't required)
//   - renders ONE big "Select highlighted item" control at the bottom — the
//     single button a one-switch user actually presses.
//
// When a screen reader is on, the scanner disables itself (handled in
// useScanner) and the items are operated directly as normal buttons.
//
// items: [{ key, label, sublabel, critical, onSelect, speech }]
// forceScan: turn scanning on even when the profile wouldn't (used by the
//   pre-profile screens — Language, Accessibility setup — so a switch user can
//   operate them before we know they're a switch user). Still yields to a
//   screen reader via useScanner.
export default function ScanGroup({ items, renderItem, forceScan = false, speedMs }) {
  const { theme } = useContext(AppContext);
  const { speak } = useSpeech();
  const { t } = useTranslation();

  const speakIndex = useCallback(
    (i) => {
      const item = items[i];
      if (item) speak(item.speech || item.label);
    },
    [items, speak]
  );

  const { index, active, screenReaderOn } = useScanner({
    itemCount: items.length,
    enabled: theme.scan.enabled || forceScan,
    speedMs: speedMs || theme.scan.speedMs || 2000,
    onSpeakItem: speakIndex,
  });

  const onSelectCurrent = () => {
    const item = items[index];
    if (item?.onSelect) item.onSelect();
  };

  return (
    <View>
      {items.map((item, i) => {
        const highlighted = active && i === index;
        if (renderItem) {
          return (
            <View key={item.key} style={{ marginBottom: theme.spacing.gap }}>
              {renderItem(item, { highlighted, index: i })}
            </View>
          );
        }
        return (
          <View key={item.key} style={{ marginBottom: theme.spacing.gap }}>
            <BigButton
              label={item.label}
              sublabel={item.sublabel}
              variant={item.variant || 'surface'}
              critical={item.critical}
              highlighted={highlighted}
              selected={item.selected}
              onPress={item.onSelect}
              accessibilityHint={item.hint}
            />
          </View>
        );
      })}

      {active ? (
        <View style={{ marginTop: theme.spacing.md }}>
          <BigButton
            label={t('common.selectHighlighted')}
            variant="primary"
            onPress={onSelectCurrent}
            accessibilityHint={items[index]?.label}
            testID="select-highlighted"
          />
        </View>
      ) : null}
    </View>
  );
}
