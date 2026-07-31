// Custom single-input auto-scanner.
//
// Drives a moving highlight across a set of items. A switch / sip-and-puff user
// operates the whole app with ONE control: wait for the item they want to be
// highlighted, then fire "select highlighted".
//
// CRITICAL a11y rule: when a screen reader (VoiceOver/TalkBack) is active, the
// scanner turns ITSELF OFF, so it does not fight the screen reader's own focus.
// This is a real bug in many accessibility apps — we avoid it here.

import { useEffect, useRef, useState, useCallback } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useScanner({ itemCount, enabled, speedMs, onSpeakItem }) {
  const [index, setIndex] = useState(0);
  const [screenReaderOn, setScreenReaderOn] = useState(false);
  const timer = useRef(null);

  // Track screen reader state so we can suspend scanning while it is on.
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (mounted) setScreenReaderOn(on);
    });
    const sub = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      (on) => mounted && setScreenReaderOn(on)
    );
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  const active = enabled && !screenReaderOn && itemCount > 0;

  // The scanning loop.
  useEffect(() => {
    if (!active) {
      if (timer.current) clearInterval(timer.current);
      return undefined;
    }
    // Announce the first item immediately, then advance on an interval.
    onSpeakItem?.(0);
    setIndex(0);
    timer.current = setInterval(() => {
      setIndex((prev) => {
        const nextIndex = (prev + 1) % itemCount;
        onSpeakItem?.(nextIndex);
        return nextIndex;
      });
    }, speedMs);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, itemCount, speedMs]);

  // "select highlighted" — returns the currently highlighted index.
  const selectCurrent = useCallback(() => index, [index]);

  return {
    index: active ? index : -1,
    active,
    screenReaderOn,
    selectCurrent,
    setIndex,
  };
}
