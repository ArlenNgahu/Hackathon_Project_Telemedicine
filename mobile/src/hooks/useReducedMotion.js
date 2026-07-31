// Reduce Motion hook backed by AccessibilityInfo (works on iOS, Android, web).
// react-native core does not export a useReducedMotion hook, so we implement a
// small one here rather than depend on react-native-reanimated.

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((on) => mounted && setReduced(!!on))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      (on) => mounted && setReduced(!!on)
    );
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  return reduced;
}
