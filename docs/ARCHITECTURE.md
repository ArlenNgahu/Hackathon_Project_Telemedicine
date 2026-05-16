
# SYSTEM ARCHITECTURE
## Quadriplegic Telemedicine Platform

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER (Accessibility-First)                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Web App    │  │ Mobile App   │  │  USSD/SMS    │  │ Voice Call   │          │
│  │  (React/Vue) │  │  (Flutter)   │  │   Gateway    │  │   (Twilio)   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                 │                   │
│         └─────────────────┴─────────────────┴─────────────────┘                   │
│                           │                                                      │
│                    ┌────────▼────────┐                                            │
│                    │  Accessibility  │                                            │
│                    │    Middleware   │                                            │
│                    │  • Voice Control│                                            │
│                    │  • Eye Tracking │                                            │
│                    │  • Large UI     │                                            │
│                    │  • Screen Reader│                                            │
│                    └────────┬────────┘                                            │
└─────────────────────────────┼─────────────────────────────────────────────────────┘
                              │ HTTPS/WSS
┌─────────────────────────────┼─────────────────────────────────────────────────────┐
│                         API GATEWAY LAYER (FastAPI)                               │
├─────────────────────────────┼─────────────────────────────────────────────────────┤
│                             │                                                      │
│  ┌──────────────────────────▼──────────────────────────┐                          │
│  │              FastAPI Application Server             │                          │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │                          │
│  │  │   Auth      │ │   Triage    │ │   Queue     │   │                          │
│  │  │   Router    │ │   Router    │ │   Router    │   │                          │
│  │  └─────────────┘ └─────────────┘ └─────────────┘   │                          │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │                          │
│  │  │  Patient    │ │   Doctor    │ │Notification │   │                          │
│  │  │   Router    │ │   Router    │ │   Router    │   │                          │
│  │  └─────────────┘ └─────────────┘ └─────────────┘   │                          │
│  └──────────────────────────┬──────────────────────────┘                          │
│                             │                                                      │
│  ┌──────────────────────────▼──────────────────────────┐                          │
│  │              Service Layer (Business Logic)         │                          │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │                          │
│  │  │ AI Triage   │ │  Virtual    │ │ Appointment │   │                          │
│  │  │  Service    │ │   Queue     │ │  Scheduler  │   │                          │
│  │  │ (ML Model)  │ │  Service    │ │   Service   │   │                          │
│  │  └─────────────┘ └─────────────┘ └─────────────┘   │                          │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │                          │
│  │  │  Voice      │ │  Notification│ │  Accessibility│  │                          │
│  │  │  Processing │ │   Service    │ │   Service     │  │                          │
│  │  │  (Whisper)  │ │ (SMS/Email)  │ │  (WCAG 2.1)   │  │                          │
│  │  └─────────────┘ └─────────────┘ └─────────────┘   │                          │
│  └─────────────────────────────────────────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┼─────────────────────────────────────────────────────┐
│                      DATA LAYER (PostgreSQL + Redis + S3)                          │
├─────────────────────────────┼─────────────────────────────────────────────────────┤
│                             │                                                      │
│  ┌──────────────────────────▼──────────────────────────┐                          │
│  │              PostgreSQL (Primary Database)          │                          │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │                          │
│  │  │   Patients  │ │   Doctors   │ │ Appointments│   │                          │
│  │  │   Table     │ │   Table     │ │   Table     │   │                          │
│  │  └─────────────┘ └─────────────┘ └─────────────┘   │                          │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │                          │
│  │  │   Triage    │ │   Queue     │ │   Medical   │   │                          │
│  │  │   Records   │ │   Tickets   │ │   History   │   │                          │
│  │  └─────────────┘ └─────────────┘ └─────────────┘   │                          │
│  └─────────────────────────────────────────────────────┘                          │
│                             │                                                      │
│  ┌──────────────────────────┼──────────────────────────┐                          │
│  │         Redis (Cache + Queue)                        │                          │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │                          │
│  │  │   Session   │ │   Virtual   │ │   Real-time │   │                          │
│  │  │   Store     │ │   Queue     │ │   Pub/Sub   │   │                          │
│  │  └─────────────┘ └─────────────┘ └─────────────┘   │                          │
│  └─────────────────────────────────────────────────────┘                          │
│                             │                                                      │
│  ┌──────────────────────────┼──────────────────────────┐                          │
│  │         S3/MinIO (Object Storage)                  │                          │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │                          │
│  │  │  Voice      │ │   Medical   │ │   Profile   │   │                          │
│  │  │  Recordings │ │   Images    │ │   Photos    │   │                          │
│  │  └─────────────┘ └─────────────┘ └─────────────┘   │                          │
│  └─────────────────────────────────────────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┼─────────────────────────────────────────────────────┐
│                   AI/ML LAYER (Python + TensorFlow/PyTorch)                       │
├─────────────────────────────┼─────────────────────────────────────────────────────┤
│                             │                                                      │
│  ┌──────────────────────────▼──────────────────────────┐                          │
│  │              AI Model Services                      │                          │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │                          │
│  │  │   Symptom   │ │   Voice-to  │ │   Priority  │   │                          │
│  │  │   Triage    │ │   Text      │ │   Queue     │   │                          │
│  │  │   (BERT)    │ │  (Whisper)  │ │  (ML)       │   │                          │
│  │  └─────────────┘ └─────────────┘ └─────────────┘   │                          │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │                          │
│  │  │   Sentiment │ │   Named     │ │   Demand    │   │                          │
│  │  │   Analysis  │ │   Entity    │ │   Forecast  │   │                          │
│  │  │   (NLP)     │ │   Recognition│ │   (Time)    │   │                          │
│  │  └─────────────┘ └─────────────┘ └─────────────┘   │                          │
│  └─────────────────────────────────────────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┼─────────────────────────────────────────────────────┐
│                   EXTERNAL INTEGRATIONS                                          │
├─────────────────────────────┼─────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │   Twilio    │ │  Hospital   │ │  Mapping    │ │  Payment    │              │
│  │  (SMS/Voice)│ │    HIS      │ │  (Google/  │ │  (M-Pesa/   │              │
│  │             │ │  Systems    │ │  OSM)       │ │  Stripe)    │              │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Client Layer - Accessibility First

**Web Application (React/Vue.js):**
- WCAG 2.1 AA compliant [^37^]
- Voice control integration (Web Speech API)
- Eye tracking support (Tobii/TechSoup integration)
- Large touch targets (minimum 44x44px)
- High contrast mode (7:1 ratio for AAA)
- Screen reader optimized (ARIA labels)
- Keyboard-only navigation support

**Mobile Application (Flutter):**
- Native voice commands
- Head gesture control (accelerometer)
- Sip-and-puff bluetooth device support
- Switch access compatibility
- Offline-first architecture

**USSD/SMS Gateway:**
- Works on any mobile phone (no smartphone required)
- *384*88# shortcode
- Voice-to-SMS for speech-impaired

**Voice Call (Twilio):**
- IVR system for appointment booking
- Voice authentication
- Caregiver conference calls

### 2. API Gateway Layer (FastAPI)

**Security Features:**
- JWT authentication with refresh tokens [^43^]
- Rate limiting (5 requests/minute per user) [^43^]
- CORS restricted to known origins [^38^]
- Input validation with Pydantic
- HIPAA/GDPR compliant logging

**Routers:**
- `/auth` - Authentication & authorization
- `/patients` - Patient CRUD + accessibility preferences
- `/triage` - AI symptom analysis
- `/queue` - Virtual queue management
- `/doctors` - Doctor availability & assignment
- `/appointments` - Scheduling
- `/notifications` - SMS/email/push

### 3. Service Layer

**AI Triage Service:**
- Symptom classification (BERT-based)
- Priority scoring: Low/Medium/High/Critical
- Confidence threshold: 85%
- Fallback to human nurse if < 85%

**Virtual Queue Service:**
- Priority queue algorithm (see below)
- ETA calculation based on doctor availability
- Automatic teleconsult promotion for low-acuity
- Real-time position updates via WebSocket

**Accessibility Service:**
- Voice command processing
- Preference persistence
- Assistive tech compatibility detection
- Caregiver proxy mode

### 4. Data Layer

**PostgreSQL:**
- Encrypted at rest (AES-256)
- Row-level security for multi-tenant
- Automated backups (daily)
- Read replicas for scaling

**Redis:**
- Session management (TTL: 24h)
- Virtual queue state
- Real-time notifications pub/sub
- Rate limiting counters

**S3/MinIO:**
- Voice recordings (encrypted)
- Medical images (DICOM compatible)
- Audit logs (immutable)

### 5. AI/ML Layer

**Symptom Triage Model:**
- Architecture: DistilBERT fine-tuned
- Input: Free text symptoms + voice transcription
- Output: Priority level + recommended action
- Training data: 50K labeled medical records

**Voice Processing:**
- OpenAI Whisper for transcription
- Custom medical vocabulary
- Noise reduction for mobility device sounds
- 95% accuracy at 0.5s latency

**Queue Optimization:**
- Time-series forecasting (Prophet)
- Doctor availability prediction
- No-show probability scoring

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 18 + TypeScript | Web UI with accessibility |
| Mobile | Flutter 3 | Cross-platform native |
| Backend | FastAPI + Python 3.11 | High-performance API |
| Database | PostgreSQL 15 + TimescaleDB | Time-series health data |
| Cache | Redis 7 | Sessions + real-time queue |
| Storage | MinIO (S3-compatible) | Medical files |
| AI/ML | PyTorch + Transformers | NLP models |
| Voice | OpenAI Whisper | Speech-to-text |
| Queue | Celery + Redis | Async task processing |
| Message | Twilio + Firebase | SMS/push notifications |
| Deploy | Docker + Kubernetes | Container orchestration |
| Monitor | Prometheus + Grafana | Observability |

## Accessibility Standards Compliance

**WCAG 2.1 Level AA [^37^]:**
- Perceivable: Alt text, captions, color contrast 4.5:1
- Operable: Keyboard-only, voice control, no time limits
- Understandable: Plain language (grade 6 reading level)
- Robust: Screen reader compatible, assistive tech APIs

**Additional Quadriplegic-Specific:**
- Switch access (single button navigation)
- Eye tracking zones (large click targets)
- Head mouse support (camera-based)
- Sip-and-puff device integration
- Caregiver remote control mode
