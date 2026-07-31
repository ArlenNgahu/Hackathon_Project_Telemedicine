// Single API layer for AfyaConnect.
//
// Every function returns the SAME shape whether USE_MOCK is on or off, so
// screens never know which mode they're in. The real backend
// (backend/main.py) is async/Postgres, built by a teammate and verified
// end-to-end against a real database (39/39 checks) before this file was
// wired to it. Two backend quirks this layer papers over:
//
//   1. /auth/login and /auth/register return only tokens, no patient - this
//      layer makes a follow-up /auth/me call so callers still get back
//      {access_token, refresh_token, token_type, patient} as one object.
//   2. Registration is two steps server-side (POST /auth/register for
//      phone+password, then POST /patients/register to save the
//      accessibility profile). register() only does step 1; the profile
//      save happens from AccessibilitySetupScreen via api.completeProfile().
//
// SAFETY: every /triage/report call MUST pass an explicit `language`. The
// backend falls back to the patient's stored preferred_language when
// `language` is omitted - so a Kiswahili-preferring patient reporting
// symptoms in English (e.g. every preset, which always sends English
// clinical text) would silently be triaged against the WRONG keyword list.
// Confirmed by testing: this turns a "critical" chest-pain report into "low".

import Constants from 'expo-constants';

// true  = self-contained demo (mock data, runs with no backend).
// false = live: talks to the FastAPI backend at expo.extra.apiBaseUrl.
// Verified working end-to-end against the real backend; kept true by default so
// the app still runs standalone (e.g. Expo Go without a server). Flip to false
// once the backend is reachable at the configured apiBaseUrl.
export const USE_MOCK = false;

const BASE_URL =
  Constants?.expoConfig?.extra?.apiBaseUrl || 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// The current auth token. AppContext calls setAuthToken() after login/register
// and on boot (from SecureStore), so authenticated endpoints (/auth/me,
// /appointments, ...) carry the Bearer token without every caller passing it.
let authToken = null;
export function setAuthToken(token) {
  authToken = token || null;
}

async function realRequest(path, { method = 'GET', body, token } = {}) {
  const bearer = token || authToken;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err = new Error(`API ${res.status}: ${detail || res.statusText}`);
    err.status = res.status; // lets callers branch (e.g. 403 = caregiver not permitted)
    throw err;
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Mock triage — mirrors the backend's keyword analysis, EN + SW + code-switch.
// Return shape === TriageResponse in backend/main.py.
// ---------------------------------------------------------------------------

const TRIAGE_RULES = [
  {
    priority: 'critical',
    urgency_minutes: 0,
    keywords: [
      'chest pain', 'kifua', 'maumivu ya kifua',
      'difficulty breathing', 'cannot breathe', 'kupumua', 'ugumu wa kupumua',
      'autonomic', 'dysreflexia', 'pounding headache and sweating',
      'headache and sweating', 'kichwa na jasho',
    ],
    conditions: [
      { name: 'Autonomic dysreflexia (possible)', likelihood: 'needs urgent check' },
      { name: 'Cardiac / respiratory emergency', likelihood: 'cannot rule out' },
    ],
    action: 'Seek emergency care now. Do not wait.',
    reasoning:
      'You described symptoms that can signal a medical emergency, including autonomic dysreflexia, which needs immediate attention for people with spinal cord injury.',
  },
  {
    priority: 'high',
    urgency_minutes: 30,
    keywords: [
      'fever', 'homa', 'bladder', 'kibofu', 'catheter', 'mrija',
      'pressure sore', 'kidonda', 'blood', 'damu', 'high fever',
    ],
    conditions: [
      { name: 'Infection (urinary / skin)', likelihood: 'likely' },
    ],
    action: 'A nurse should see you soon. Please join the queue.',
    reasoning:
      'Fever, catheter problems and pressure sores can become serious infections quickly for people with limited mobility, so they are prioritised.',
  },
  {
    priority: 'medium',
    urgency_minutes: 120,
    keywords: ['headache', 'kichwa', 'nausea', 'kichefuchefu', 'dizzy', 'kizunguzungu', 'tired', 'uchovu'],
    conditions: [{ name: 'General unwellness', likelihood: 'to assess' }],
    action: 'Join the queue to speak with a nurse today.',
    reasoning: 'Your symptoms should be checked but are not immediately dangerous.',
  },
];

function mockTriage(symptomsText) {
  const text = (symptomsText || '').toLowerCase();
  const matched = [];
  let rule = null;
  for (const r of TRIAGE_RULES) {
    const hits = r.keywords.filter((k) => text.includes(k));
    if (hits.length) {
      matched.push(...hits);
      rule = r;
      break; // rules are ordered most-severe first
    }
  }
  if (!rule) {
    rule = {
      priority: 'low',
      urgency_minutes: 240,
      conditions: [{ name: 'No urgent signs detected', likelihood: 'routine' }],
      action: 'You can book a routine consultation. Join the queue when ready.',
      reasoning: 'No urgent keywords were detected in your description.',
    };
  }
  return {
    triage_id: `mock-triage-${Date.now()}`,
    priority: rule.priority,
    confidence: matched.length ? 0.86 : 0.6,
    recommended_action: rule.action,
    urgency_minutes: rule.urgency_minutes,
    reasoning: rule.reasoning,
    matched_symptoms: Array.from(new Set(matched)),
    potential_conditions: rule.conditions,
  };
}

// In-memory mock queue so status can advance believably between polls.
const mockTickets = {};

function priorityRank(p) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[p] ?? 3;
}

// ---------------------------------------------------------------------------
// Public API surface
// ---------------------------------------------------------------------------

export const api = {
  // ---- AUTH ----
  async login({ phone, password }) {
    if (USE_MOCK) {
      await wait(500);
      if (!phone || !password) throw new Error('invalid_credentials');
      return {
        access_token: `mock-token-${Date.now()}`,
        token_type: 'bearer',
        patient: mockMe(phone),
      };
    }
    // Backend field is phone_primary, and the response carries only tokens -
    // fetch the patient in a follow-up call so callers get one combined object.
    const tokens = await realRequest('/auth/login', {
      method: 'POST',
      body: { phone_primary: phone, password },
    });
    const patient = await realRequest('/auth/me', { token: tokens.access_token });
    return { ...tokens, patient };
  },

  async register({ name, phone, password, preferred_language }) {
    if (USE_MOCK) {
      await wait(600);
      const [first_name, ...rest] = (name || '').trim().split(' ');
      const patient_id = `P${Date.now()}`;
      return {
        access_token: `mock-token-${Date.now()}`,
        token_type: 'bearer',
        patient: {
          ...mockMe(phone),
          patient_id,
          first_name: first_name || 'Friend',
          last_name: rest.join(' '),
          preferred_language: preferred_language || 'en',
        },
      };
    }
    // Step 1 of 2 server-side: phone + password only. AccessibilitySetupScreen
    // calls api.completeProfile() next (step 2) to save the chosen profile.
    const [first_name, ...rest] = (name || '').trim().split(' ');
    const tokens = await realRequest('/auth/register', {
      method: 'POST',
      body: {
        first_name: first_name || 'Friend',
        last_name: rest.join(' ') || '-',
        phone_primary: phone,
        password,
        preferred_language: preferred_language || 'en',
      },
    });
    const patient = await realRequest('/auth/me', { token: tokens.access_token });
    return { ...tokens, patient };
  },

  async me({ token }) {
    if (USE_MOCK) {
      await wait(200);
      return mockMe();
    }
    return realRequest('/auth/me', { token });
  },

  // Step 2 of registration (and later profile edits): save the accessibility
  // profile / medical / caregiver / address fields. Partial - only send what
  // changed. Called from AccessibilitySetupScreen right after register(), and
  // from ProfileScreen's edit-save.
  async completeProfile(fields) {
    if (USE_MOCK) {
      await wait(400);
      return { success: true, _mock: true };
    }
    return realRequest('/patients/register', { method: 'POST', body: fields });
  },

  // ---- TRIAGE ----
  // `language` is REQUIRED in real mode - see the safety note at the top of
  // this file. Callers: SymptomReportScreen passes 'en' for presets (always
  // English clinical text) and the current app language for free text.
  async reportSymptoms({ patient_id, symptoms_text, pain_level, duration_hours, language }) {
    if (USE_MOCK) {
      await wait(700);
      return mockTriage(symptoms_text);
    }
    return realRequest('/triage/report', {
      method: 'POST',
      body: { patient_id, symptoms_text, pain_level, duration_hours, language },
    });
  },

  // ---- QUEUE ----
  async joinQueue({ patient_id, patient_name, priority, is_pwd = true }) {
    if (USE_MOCK) {
      await wait(500);
      const ticket_id = `T${Date.now()}`;
      // Position seeded by clinical priority; PWDs sorted up within a tier.
      const basePos = priorityRank(priority) * 3 + 2;
      mockTickets[ticket_id] = {
        ticket_id,
        priority,
        is_pwd,
        position: basePos,
        total_waiting: basePos + 4,
        lastPolled: Date.now(),
      };
      const estimated_wait_minutes = basePos * 8;
      const teleconsult_offered =
        estimated_wait_minutes > 45 && ['low', 'medium'].includes(priority);
      return {
        ticket_id,
        position: basePos,
        total_waiting: basePos + 4,
        estimated_wait_minutes,
        eta: new Date(Date.now() + estimated_wait_minutes * 60000).toISOString(),
        clinical_priority: priority,
        is_pwd,
        teleconsult_offered,
        message: `You are position ${basePos} of ${basePos + 4}. Estimated wait: ${estimated_wait_minutes} minutes.`,
      };
    }
    return realRequest('/queue/join', {
      method: 'POST',
      body: { patient_id, patient_name, priority, is_pwd },
    });
  },

  async queueStatus({ ticket_id }) {
    if (USE_MOCK) {
      await wait(300);
      const t = mockTickets[ticket_id];
      if (!t) throw new Error('Ticket not found');
      // Advance ~1 position every poll so the demo visibly progresses.
      const elapsed = Date.now() - t.lastPolled;
      if (elapsed > 1500 && t.position > 1) {
        t.position -= 1;
        t.total_waiting = Math.max(t.total_waiting - 1, t.position);
        t.lastPolled = Date.now();
      }
      const estimated_wait_minutes = t.position * 8;
      const teleconsult_offered =
        estimated_wait_minutes > 45 && ['low', 'medium'].includes(t.priority);
      return {
        ticket_id,
        position: t.position,
        total_waiting: t.total_waiting,
        estimated_wait_minutes,
        eta: new Date(Date.now() + estimated_wait_minutes * 60000).toISOString(),
        clinical_priority: t.priority,
        is_pwd: t.is_pwd,
        teleconsult_offered,
        message: `You are position ${t.position} of ${t.total_waiting}. Estimated wait: ${estimated_wait_minutes} minutes.`,
      };
    }
    return realRequest(`/queue/status/${ticket_id}`);
  },

  async acceptTeleconsult({ ticket_id }) {
    if (USE_MOCK) {
      await wait(500);
      delete mockTickets[ticket_id];
      return {
        success: true,
        message: 'Teleconsult accepted. You will receive a video call link via SMS.',
        next_steps: [
          'Check SMS for meeting link',
          'Test camera and microphone',
          'Have medications list ready',
          'Caregiver can join if needed',
        ],
      };
    }
    return realRequest(`/queue/teleconsult/accept/${ticket_id}`, { method: 'POST' });
  },

  // ---- APPOINTMENTS ----
  async appointments({ patient_id }) {
    if (USE_MOCK) {
      await wait(400);
      return { appointments: MOCK_APPOINTMENTS, _mock: true };
    }
    // patient_id isn't sent - the backend derives it from the auth token.
    return realRequest('/appointments');
  },

  // Book an appointment off a completed triage. `triage_id` is required by
  // the real backend (an appointment always follows a triage record).
  // `acting_as_caregiver: true` routes through the backend's
  // caregiver_can_schedule permission gate - a 403 there means this
  // caregiver isn't authorized (err.status === 403; see realRequest above).
  async createAppointment({ patient_id, triage_id, appointment_type, acting_as_caregiver }) {
    if (USE_MOCK) {
      await wait(500);
      const entry = {
        id: `A${Date.now()}`,
        type: appointment_type,
        provider: _PROVIDER_DEFAULT[appointment_type] || 'Care team',
        starts_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        joinable: appointment_type === 'teleconsult',
      };
      MOCK_APPOINTMENTS.unshift(entry);
      return {
        success: true,
        appointment_id: entry.id,
        appointment_type,
        scheduled_time: entry.starts_at,
        status: 'scheduled',
        _mock: true,
      };
    }
    return realRequest('/appointments', {
      method: 'POST',
      body: { patient_id, triage_id, appointment_type, acting_as_caregiver: !!acting_as_caregiver },
    });
  },

  // ---- CAREGIVER AUDIT LOG ----
  // NARROW on purpose: the real backend only accepts the two session-transition
  // actions below (enter/exit caregiver mode). Every other caregiver action
  // (schedule an appointment, etc.) is audited server-side automatically, next
  // to the actual data mutation - do NOT call this for those; the backend
  // will reject an unrecognized `action` with 422.
  async logCaregiverAction({ patient_id, action, meta }) {
    const entry = { patient_id, action, meta: meta || {}, timestamp: new Date().toISOString() };
    if (USE_MOCK) {
      console.log('[AUDIT:MOCK]', entry);
      return { logged: true, _mock: true, entry };
    }
    return realRequest('/audit/log', { method: 'POST', body: { patient_id, action, meta } });
  },

  // ---- VOICE ----
  async voiceCommand({ patient_id, audio_data, command_type }) {
    if (USE_MOCK) {
      await wait(300);
      return { action: command_type, message: 'Command received', _mock: true };
    }
    return realRequest('/voice/command', {
      method: 'POST',
      body: { patient_id, audio_data, command_type },
    });
  },
};

// ---------------------------------------------------------------------------
// Mock fixtures
// ---------------------------------------------------------------------------

function mockMe(phone = '+254712345678') {
  return {
    patient_id: 'P20260729',
    first_name: 'Amina',
    last_name: 'Wanjiru',
    phone_primary: phone,
    phone_emergency: '+254733111222',
    disability_type: 'quadriplegia',
    primary_assistive_tech: 'switch',
    preferred_language: 'en',
    has_caregiver: true,
    caregiver_name: 'Joseph Mwangi',
    caregiver_phone: '+254799888777',
    caregiver_can_schedule: true,
    caregiver_can_consent: false,
    conditions: ['Spinal cord injury (C5)', 'Neurogenic bladder'],
    medications: ['Baclofen', 'Oxybutynin'],
    allergies: ['Penicillin'],
    address_line1: 'House 12, Jamii Estate',
    city: 'Nairobi',
    region: 'Nairobi',
  };
}

// Matches backend/main.py's _PROVIDER_DEFAULT so a mock-mode booking's
// placeholder provider text reads the same as a real one.
const _PROVIDER_DEFAULT = {
  teleconsult: 'AfyaConnect teleconsult',
  hospital: 'Hospital visit',
  home_visit: 'Home visit nurse',
};

const MOCK_APPOINTMENTS = [
  {
    id: 'A1001',
    type: 'teleconsult',
    provider: 'Dr. Otieno (Rehab Medicine)',
    starts_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    joinable: true,
  },
  {
    id: 'A1002',
    type: 'home_visit',
    provider: 'Nurse Faith — wound care',
    starts_at: new Date(Date.now() + 2 * 86400 * 1000).toISOString(),
    joinable: false,
  },
  {
    id: 'A1003',
    type: 'hospital',
    provider: 'Kenyatta National Hospital — Urology',
    starts_at: new Date(Date.now() + 6 * 86400 * 1000).toISOString(),
    joinable: false,
  },
];
