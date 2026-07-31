# AfyaConnect — mobile app

Accessibility-first telemedicine for people with disabilities in Kenya.
**"Care. Connect. Anywhere."** — Expo (SDK 52) + React Native 0.76, light theme,
bilingual (English + Kiswahili).

## Run it

```bash
cd mobile
npm install
npx expo start        # press i / a, or scan the QR with Expo Go
```

- **TTS (expo-speech)** works in Expo Go.
- **STT (expo-speech-recognition)** needs a dev build. It is feature-gated: in
  Expo Go the mic button falls back to a typed-confirmation modal. Nothing is
  faked.

## The non-negotiable: four paths on every screen

Every screen supports all four, driven entirely by `getAccessibilityTheme()` in
`src/theme/accessibility.js` (screens never hardcode a size or color):

1. **Spoken** — `SpokenScreen` announces the screen's purpose aloud on mount, in
   the user's language, and mirrors it to the screen-reader live region.
2. **Single-input** — `ScanGroup` / `useScanner` auto-highlights items, speaks
   each as it lands, and exposes one "Select highlighted" control. The scanner
   **turns itself off when a screen reader is active** (so it doesn't fight
   VoiceOver/TalkBack focus).
3. **Screen-reader** — roles, labels, states, hints, live regions, modal focus.
4. **Large-touch** — ≥48pt targets (up to 90pt per profile), `hitSlop`, spacing.

## Screens (all 12 built)

| # | Screen | Notable paths |
|---|---|---|
| 1 | LanguageSelect | spoken in **both** languages; force-scan pre-profile |
| 2 | Auth | keyboard-avoiding; live-region validation errors |
| 3 | AccessibilitySetup | force-scan + speaks options *before* profile is known |
| 4 | Home | voice-first mic vs. scanner list; bilingual command routing |
| 5 | SymptomReport | preset picker (primary for switch users) + voice + text; one scanner spans all controls; critical presets get the red border |
| 6 | TriageResult | result spoken on arrival; clinical color card |
| 7 | QueueStatus | auto-refresh; **milestone-only** announcements; teleconsult offer |
| 8 | Appointments | invitation empty state; lists real bookings via `GET /appointments` |
| 9 | Emergency | one action from any screen; red bg; force-scan; spoken every step |
| 10 | CaregiverProxy | confirmation-only entry; write actions gated by `caregiver_can_*`; session transitions logged via `POST /audit/log` |
| 11 | Settings | re-tune language/profile/scan speed/font/dwell/contrast in the current mode |
| 12 | Profile | read-only first; edit behind an explicit action |

## Modes — honest status

- **Fully built:** voice (TTS now, STT in a dev build), the custom switch/sip-puff
  scanner, caregiver proxy, and OS-accessibility conformance (roles/labels/focus)
  — which is what lets real head-mouse / eye-tracking hardware drive the app.
- **Not faked:** no in-app camera eye-tracking, no pretend Bluetooth sip-puff
  "connection". Head-mouse / eye-tracking rely on OS accessible-pointer support
  (iOS 17+ for eye tracking; not native on Android). Our job there is conformance.

## Backend

The real backend (`backend/main.py`) is async FastAPI + SQLAlchemy + Postgres,
with Alembic migrations (`alembic/`). It's built on a teammate's more complete
implementation — JWT access + refresh tokens, timing-safe login, bilingual
(EN/SW) triage with a language auto-detect fallback, an audit log, and an SMS
notification service — merged in on top of the original mocked demo. Verified
end-to-end against a real Postgres database: 39/39 backend checks, plus a full
mobile-app run through register → accessibility setup → symptom report → real
triage → real DB rows, with zero console errors.

Run it (needs a Postgres instance; see `docker-compose.yml` for one, or point
`DATABASE_URL` at your own):

```bash
DATABASE_URL=postgresql+psycopg://user:pass@localhost/afyaconnect alembic upgrade head
DATABASE_URL=postgresql+psycopg://user:pass@localhost/afyaconnect \
  uvicorn backend.main:app --reload
```

`src/services/api.js` has a single `USE_MOCK` flag (default `true` — the app
runs standalone with mock data, no backend needed). Flip to `false` once a
backend is reachable at `expo.extra.apiBaseUrl`; the two-step registration
flow (`/auth/register` then `/patients/register` for the accessibility
profile) and every other real-mode call is already wired to the current
backend's actual contract, not just its shape on paper.

### ⚠️ A safety bug this integration found and fixed

The triage engine falls back to a patient's *stored* `preferred_language`
whenever a `/triage/report` call omits an explicit `language`. Discovered by
testing: a patient with `preferred_language: "sw"` reporting **English**
critical symptoms (e.g. tapping the "Chest pain" preset, which always sends
English clinical text) got silently triaged as **"low" instead of
"critical"** — the engine matched against the wrong keyword list entirely.

Mobile now always sends an explicit `language` on every triage report:
`"en"` for presets (which always carry English text), and the app's current
UI language for free-text descriptions. See the safety note at the top of
`api.js` and the regression-guard test in the backend test suite for the
gory details. If you touch triage language selection, re-run that guard.

### Other real bugs found by testing (now fixed)

- **Assistive-tech value mismatch**: the DB's `AssistiveTech` enum stores
  descriptive values (`sip_and_puff`, `switch_access`, `voice_control`); the
  API/mobile layer uses short tokens (`sip_puff`, `switch`, `voice`) that
  match the app's i18n keys. Code that converted by `.value` instead of by
  enum member *name* silently collapsed every switch/sip-puff/voice patient's
  profile to `"none"` on `/auth/me` and the profile-update response — exactly
  the three profiles this app exists to serve. Fixed with a name-based
  `_app_tech()` helper in `backend/main.py`.
- **Postgres enum insert mismatch**: `Column(Enum(...))` without
  `values_callable` sends the Python member *name* on insert, but the Alembic
  migration created the native Postgres enum types using the lowercase
  *values* — every insert of a `disability_type`/`assistive_tech`/etc. column
  failed. Fixed with a `_pg_enum()` helper in `backend/app/models/database.py`.
- **`/auth/me` was missing fields** ProfileScreen needs (conditions,
  medications, allergies, caregiver name/phone, address) even though the
  Patient model already stores them — the patient's own token clearly should
  be able to read their own data. Expanded the response.
- **`TriageResponse` didn't return the triage record's ID**, so no client
  could ever call `POST /appointments` (which requires it). Added
  `triage_id` to the response.

### Mock/stub points remaining (mock mode only — real backend covers all of these)

- **Queue** — mock mode: in-memory ticket advances ~1 position per poll.
- **Emergency** — mock alert to caregiver + care team (no fake ambulance dispatch,
  in either mode — that integration doesn't exist yet).

## Bilingual & safety

- All strings via `t()` from `src/i18n/en.json` / `sw.json`. TTS speaks `en-US` /
  `sw-KE`.
- **Every clinical/triage Kiswahili term is flagged for review** in
  `src/i18n/NEEDS_SW_REVIEW.md`. A wrong medical term in triage is a safety issue,
  not a typo — do not ship those translations to real patients unreviewed.
- Voice-command matching handles code-switching (`src/services/voiceCommands.js`).

## Not automatable here

The a11y checklist item "manually tested with VoiceOver and TalkBack" requires a
real device/simulator and a human. Everything else in the checklist is wired in
code; VoiceOver/TalkBack passes still need to be done before calling a screen
truly "done".
