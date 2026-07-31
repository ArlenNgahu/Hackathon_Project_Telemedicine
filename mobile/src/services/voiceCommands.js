// Bilingual + code-switching voice command matcher.
//
// Kenyan users routinely code-switch ("nina chest pain kidogo", "nataka daktari").
// So we match against BOTH English and Kiswahili keyword sets and never require a
// clean single-language sentence. Returns a route intent or null.
//
// A native speaker should expand the Kiswahili keyword lists — see
// i18n/NEEDS_SW_REVIEW.md.

const INTENTS = [
  {
    intent: 'emergency',
    keywords: ['emergency', 'help', 'ambulance', 'dharura', 'msaada', 'gari la wagonjwa', 'nisaidie'],
  },
  {
    intent: 'symptoms',
    keywords: [
      'symptom', 'report', 'sick', 'pain', 'feel', 'chest', 'fever', 'breathe',
      'dalili', 'ripoti', 'mgonjwa', 'maumivu', 'homa', 'kifua', 'kupumua', 'najisikia',
    ],
  },
  {
    intent: 'queue',
    keywords: ['queue', 'line', 'position', 'wait', 'foleni', 'msululu', 'nafasi', 'subiri'],
  },
  {
    intent: 'appointments',
    keywords: ['appointment', 'visit', 'doctor', 'booking', 'miadi', 'ziara', 'daktari'],
  },
  {
    intent: 'settings',
    keywords: ['setting', 'language', 'change', 'mipangilio', 'lugha', 'badilisha'],
  },
  {
    intent: 'profile',
    keywords: ['profile', 'my details', 'wasifu', 'maelezo yangu'],
  },
];

export function matchVoiceCommand(transcript) {
  if (!transcript) return null;
  const text = transcript.toLowerCase();
  // Emergency wins if present, regardless of position in the sentence.
  const emergency = INTENTS.find((i) => i.intent === 'emergency');
  if (emergency.keywords.some((k) => text.includes(k))) return 'emergency';

  for (const i of INTENTS) {
    if (i.intent === 'emergency') continue;
    if (i.keywords.some((k) => text.includes(k))) return i.intent;
  }
  return null;
}
