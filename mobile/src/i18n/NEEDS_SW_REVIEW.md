# Kiswahili terms that MUST be reviewed by a fluent speaker before real use

> A wrong medical term in triage is a **safety issue, not a typo**. The strings
> below are my best-effort translations. Do not ship them to real patients until
> a fluent Kenyan Kiswahili speaker with clinical familiarity has reviewed each
> one. Non-medical UI strings are not listed here.

## Clinical / triage terms (highest priority to review)

| Key | English | My best-effort Kiswahili | Confidence | Notes |
|---|---|---|---|---|
| `symptom.presets.chest_pain` | Chest pain | Maumivu ya kifua | high | Common, widely understood. |
| `symptom.presets.headache_sweating` | Bad headache with sweating | Maumivu makali ya kichwa na jasho | medium | This preset doubles as an **autonomic dysreflexia** signal — the phrasing should make a patient recognise their own AD symptoms. Consider clinician wording. |
| `symptom.presets.fever` | Fever | Homa | high | Standard. |
| `symptom.presets.breathing` | Difficulty breathing | Ugumu wa kupumua | high | "Kupumua kwa shida" is an alternative — confirm preferred. |
| `symptom.presets.bladder` | Bladder or catheter problem | Tatizo la kibofu au mrija (catheter) | low | Left English "catheter" in parentheses on purpose; there's no universally recognised Kiswahili loanword. Confirm patients understand "mrija". |
| `symptom.presets.pressure_sore` | Pressure sore | Kidonda cha mgandamizo | low | Uncertain. May be better expressed descriptively ("kidonda cha kukaa/kulala muda mrefu"). Needs clinical review. |
| `triage.priority.critical` | Critical | Hatari kubwa | medium | Must read as clinically urgent, not merely "dangerous". |
| `triage.priority.high` | High | Juu | medium | Confirm this reads as urgency, not literal "up/above". |
| `triage.priority.medium` | Medium | Wastani | high | |
| `triage.action.immediate_hospital` | Go to the hospital immediately. | Nenda hospitalini mara moja. | high | Direct, standard. |
| `triage.action.hospital_or_home_visit` | You need urgent care — a hospital visit or a home visit nurse. | Unahitaji huduma ya haraka — ziara ya hospitali au muuguzi wa nyumbani. | medium | Confirm urgency comes through as strongly as the English. |
| `triage.action.home_visit_priority` | We'll prioritise a home visit nurse for you. | Tutapanga kipaumbele ziara ya muuguzi nyumbani kwako. | low | "Kipaumbele" (priority) placement may read awkwardly — needs a native speaker's ear. |
| `triage.action.teleconsult_or_scheduled_visit` | Book a video consultation or a clinic visit. | Panga mashauriano ya video au ziara ya kliniki. | medium | |
| `triage.action.teleconsult_priority` | We recommend a video consultation to avoid travel. | Tunapendekeza mashauriano ya video ili kuepuka safari. | medium | |
| `triage.action.hospital_or_teleconsult` | You need care soon — a hospital visit or a video consultation. | Unahitaji huduma hivi karibuni — ziara ya hospitali au mashauriano ya video. | medium | |
| `triage.action.self_care_with_follow_up` | Manage this at home and follow up if it doesn't improve. | Jitunze nyumbani na ufuatilie kama hali haiboreki. | medium | Make sure this doesn't read as dismissive for a patient who is actually worried. |
| `triage.priority.low` | Low | Chini | medium | Confirm reads as urgency level. |
| `symptom.painLevel` | Pain level | Kiwango cha maumivu | high | |

## Also worth a native-speaker pass (non-clinical but user-facing)

- `queue.youAreNext` — "Wewe ni wa pili sasa" (lit. "you are second") is used to mean "you're next after the person being seen". Confirm this is natural.
- `app.tagline` — "Huduma. Muunganiko. Popote." is a translation of "Care. Connect. Anywhere." Marketing tone may want a fluent rewrite.
- `caregiver.*` — consent/audit phrasing is legally flavoured; confirm tone is right.

## Voice command keywords (see `services/voiceCommands.js`)

Code-switching is expected ("nina chest pain kidogo"). The keyword matcher
includes both English and Kiswahili triggers. A native speaker should expand the
Kiswahili keyword lists (especially regional/colloquial symptom words).
