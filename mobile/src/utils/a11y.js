// Accessibility helpers shared across screens.

import { AccessibilityInfo, Platform } from 'react-native';

// Announce a message to the screen reader's live region.
// iOS needs a delay after navigation transitions or the announcement is dropped
// while VoiceOver is still moving focus to the new screen.
export function announce(message, { delay } = {}) {
  if (!message) return;
  const d = delay ?? (Platform.OS === 'ios' ? 700 : 200);
  setTimeout(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, d);
}

// Resolve whether a screen reader is currently running (async).
export async function isScreenReaderOn() {
  try {
    return await AccessibilityInfo.isScreenReaderEnabled();
  } catch {
    return false;
  }
}
