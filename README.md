# Quadriplegic Telemedicine Platform

An accessibility-first telemedicine system designed specifically for patients with quadriplegia and severe mobility impairments.

## 🎯 Mission

**"Healthcare without barriers"** - Enable quadriplegic patients to access quality healthcare from home, reducing the physical burden of hospital visits while ensuring timely care through AI-powered triage and smart queue management.

## ✨ Key Features

### Accessibility-First Design
- 🎤 **Voice Control** - Hands-free operation via speech commands
- 👁️ **Eye Tracking Support** - Large dwell targets for gaze interaction  
- 🔘 **Switch Access** - Single-button navigation for assistive switches
- 👤 **Caregiver Proxy Mode** - Delegated access with full audit trail
- 📱 **Multiple Interfaces** - Web, mobile, USSD, and voice call

### AI-Powered Healthcare
- 🧠 **Smart Triage** - ML model trained on SCI-specific complications
- ⚡ **Autonomic Dysreflexia Detection** - Critical emergency identification
- 📊 **Priority Queue** - Two-layer system (clinical + accessibility)
- 🏥 **Virtual Queue** - Scheduled hospital slots, no waiting in lines

### Intelligent Coordination
- 👨‍⚕️ **Doctor Matching** - Specialists with disability training
- 🏠 **Home Visits** - Coordinated care for immobile patients
- 🚑 **Emergency Response** - Direct ambulance dispatch for critical cases

## 🚀 Quick Start

```bash
# Start with Docker
docker-compose up --build

# Access services
- Web UI: http://localhost
- API: http://localhost:8000
- Docs: http://localhost:8000/docs
```

## 📋 API Examples

### Register Patient
```bash
curl -X POST "http://localhost:8000/patients/register" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Kamau", 
    "phone_primary": "+254712345678",
    "disability_type": "quadriplegia",
    "primary_assistive_tech": "voice"
  }'
```

### Report Symptoms
```bash
curl -X POST "http://localhost:8000/triage/report" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "P001",
    "symptoms_text": "severe headache and high blood pressure"
  }'
```

## 🏗️ Architecture

```
Client (Voice/Eye/Switch) → FastAPI → AI Triage → Virtual Queue → PostgreSQL/Redis
```

## 📊 Datasets

- `sci_symptoms.csv` - 25 spinal cord injury symptoms
- `triage_training_data.csv` - 30 labeled training examples
- `doctors.csv` - 8 doctors with specialties
- `patients.csv` - 6 sample patients

## 🔒 Security

- HIPAA compliant encryption
- JWT authentication
- Audit logging
- Role-based access

## 💰 Cost

~$484/month on AWS ECS Fargate

## 📄 License

MIT License
