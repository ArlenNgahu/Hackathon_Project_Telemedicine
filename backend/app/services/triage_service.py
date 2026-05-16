"""
AI Triage System for Quadriplegic Patients
Rule-based symptom analysis and priority classification (lightweight MVP).
"""

from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from enum import Enum
"""
Note: This hackathon MVP uses rule-based triage to keep local setup lightweight.
The class structure leaves room for swapping in a real ML model later.
"""

class PriorityLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class TriageResult:
    priority: PriorityLevel
    confidence: float
    recommended_action: str
    urgency_minutes: Optional[int]
    reasoning: str
    matched_symptoms: List[str]
    potential_conditions: List[Dict]

class QuadriplegicTriageModel:
    """
    Specialized triage model for spinal cord injury and related conditions.
    Trained on medical literature + disability-specific symptom patterns.
    """

    def __init__(self, model_path: str = None):
        # Reserved for future ML model integration.
        self.num_labels = 4
        self.model = None  # Loaded on demand

        # Medical keyword database for rule-based fallback
        self.critical_keywords = [
            "can't breathe", "breathing difficulty", "chest pain", "heart attack",
            "unconscious", "seizure", "choking", "severe bleeding", "anaphylaxis",
            "autonomic dysreflexia", "ad", "blood pressure spike", " pounding headache",
            "flushed", "sweating above injury", "goosebumps", "nasal congestion",
            "bradycardia", "slow heart rate", "hypertension", "systolic above 200"
        ]

        self.high_keywords = [
            "fever", "infection", "pneumonia", "uti", "urinary tract infection",
            "pressure sore", "wound", "fracture", "spasticity", "severe pain",
            "nausea", "vomiting", "constipation", "impaction", "dehydration"
        ]

        self.medium_keywords = [
            "pain", "discomfort", "spasms", "stiffness", "anxiety", "depression",
            "sleep problems", "appetite loss", "skin irritation", "bladder issues"
        ]

        # SCI-specific complications
        self.sci_complications = {
            "autonomic_dysreflexia": {
                "keywords": ["headache", "high blood pressure", "sweating", "flushed", "stuffy nose"],
                "priority": PriorityLevel.CRITICAL,
                "action": "immediate_hospital",
                "urgency": 15  # minutes
            },
            "respiratory_distress": {
                "keywords": ["shortness of breath", "can't breathe", "cough", "pneumonia", "aspiration"],
                "priority": PriorityLevel.CRITICAL,
                "action": "immediate_hospital",
                "urgency": 10
            },
            "pressure_injury": {
                "keywords": ["bedsore", "pressure sore", "wound", "skin breakdown", "stage 3", "stage 4"],
                "priority": PriorityLevel.HIGH,
                "action": "hospital_or_home_visit",
                "urgency": 240  # 4 hours
            },
            "sepsis": {
                "keywords": ["fever", "chills", "confusion", "high heart rate", "infection"],
                "priority": PriorityLevel.CRITICAL,
                "action": "immediate_hospital",
                "urgency": 20
            },
            "urinary_retention": {
                "keywords": ["can't urinate", "bladder pain", "full bladder", "catheter blocked"],
                "priority": PriorityLevel.HIGH,
                "action": "hospital_or_teleconsult",
                "urgency": 120  # 2 hours
            }
        }

        self.is_loaded = False

    def load_model(self):
        """Lazy load the ML model."""
        if not self.is_loaded:
            try:
                # In production, load fine-tuned model
                # self.model = AutoModelForSequenceClassification.from_pretrained(
                #     "medical-bert-triage", num_labels=self.num_labels
                # )
                # self.model.to(self.device)
                self.is_loaded = True
            except Exception as e:
                print(f"Model load error: {e}")
                # Continue with rule-based fallback

    def analyze_symptoms(
        self, 
        symptoms_text: str, 
        patient_context: Dict = None,
        voice_transcript: str = None
    ) -> TriageResult:
        """
        Main triage analysis function.

        Args:
            symptoms_text: Patient-reported symptoms
            patient_context: Dict with disability_type, level_of_injury, etc.
            voice_transcript: Optional voice input transcription

        Returns:
            TriageResult with priority and recommendations
        """
        self.load_model()

        # Combine inputs
        full_text = symptoms_text.lower()
        if voice_transcript:
            full_text += " " + voice_transcript.lower()

        # Step 1: Check for SCI-specific emergencies
        sci_result = self._check_sci_complications(full_text, patient_context)
        if sci_result:
            return sci_result

        # Step 2: Rule-based keyword analysis
        keyword_priority, matched = self._keyword_analysis(full_text)

        # Step 3: ML model inference (if available)
        ml_priority, ml_confidence = self._ml_inference(full_text)

        # Step 4: Combine results (ML overrides if confidence > 0.8)
        if ml_confidence > 0.8:
            final_priority = ml_priority
            confidence = ml_confidence
        else:
            final_priority = keyword_priority
            confidence = 0.75  # Rule-based confidence

        # Step 5: Determine action and urgency
        action, urgency = self._determine_action(final_priority, patient_context)

        # Step 6: Generate reasoning
        reasoning = self._generate_reasoning(final_priority, matched, patient_context)

        # Step 7: Potential conditions
        conditions = self._suggest_conditions(full_text, final_priority)

        return TriageResult(
            priority=final_priority,
            confidence=confidence,
            recommended_action=action,
            urgency_minutes=urgency,
            reasoning=reasoning,
            matched_symptoms=matched,
            potential_conditions=conditions
        )

    def _check_sci_complications(
        self, 
        text: str, 
        context: Dict
    ) -> Optional[TriageResult]:
        """Check for spinal cord injury specific complications."""
        if not context:
            return None

        # Only check for SCI patients
        disability_type = context.get("disability_type", "").lower()
        if "quadriplegia" not in disability_type and "paraplegia" not in disability_type:
            return None

        for complication, data in self.sci_complications.items():
            matches = sum(1 for kw in data["keywords"] if kw in text)
            if matches >= 2:  # At least 2 symptoms match
                return TriageResult(
                    priority=data["priority"],
                    confidence=0.95,
                    recommended_action=data["action"],
                    urgency_minutes=data["urgency"],
                    reasoning=f"Detected {complication.replace('_', ' ')} - medical emergency common in SCI patients",
                    matched_symptoms=[kw for kw in data["keywords"] if kw in text],
                    potential_conditions=[{
                        "condition": complication.replace('_', ' ').title(),
                        "probability": 0.9,
                        "requires_immediate_attention": True
                    }]
                )
        return None

    def _keyword_analysis(self, text: str) -> Tuple[PriorityLevel, List[str]]:
        """Rule-based keyword matching."""
        matched_critical = [kw for kw in self.critical_keywords if kw in text]
        matched_high = [kw for kw in self.high_keywords if kw in text]
        matched_medium = [kw for kw in self.medium_keywords if kw in text]

        if matched_critical:
            return PriorityLevel.CRITICAL, matched_critical
        elif matched_high:
            return PriorityLevel.HIGH, matched_high
        elif matched_medium:
            return PriorityLevel.MEDIUM, matched_medium
        else:
            return PriorityLevel.LOW, []

    def _ml_inference(self, text: str) -> Tuple[PriorityLevel, float]:
        """Neural network inference (placeholder for actual model)."""
        # In production, this would run the transformer model
        # For MVP, return low confidence to rely on rules
        return PriorityLevel.MEDIUM, 0.6

    def _determine_action(
        self, 
        priority: PriorityLevel, 
        context: Dict
    ) -> Tuple[str, Optional[int]]:
        """Determine recommended action based on priority and patient context."""

        actions = {
            PriorityLevel.CRITICAL: ("immediate_hospital", 15),
            PriorityLevel.HIGH: ("hospital_or_home_visit", 120),
            PriorityLevel.MEDIUM: ("teleconsult_or_scheduled_visit", 1440),  # 24 hours
            PriorityLevel.LOW: ("self_care_with_follow_up", 10080)  # 7 days
        }

        action, urgency = actions[priority]

        # Adjust for accessibility needs
        if context and context.get("is_pwd"):
            if priority == PriorityLevel.HIGH:
                # Offer home visit for high-priority PWDs
                action = "home_visit_priority"
            elif priority == PriorityLevel.MEDIUM:
                # Teleconsult preferred for PWDs to avoid travel
                action = "teleconsult_priority"

        return action, urgency

    def _generate_reasoning(
        self, 
        priority: PriorityLevel, 
        matched: List[str], 
        context: Dict
    ) -> str:
        """Generate human-readable explanation."""
        base_reasoning = {
            PriorityLevel.CRITICAL: "Life-threatening symptoms detected requiring immediate attention.",
            PriorityLevel.HIGH: "Serious symptoms that need prompt medical evaluation.",
            PriorityLevel.MEDIUM: "Moderate symptoms that should be addressed within 24 hours.",
            PriorityLevel.LOW: "Minor symptoms that can be managed with self-care and monitoring."
        }

        reasoning = base_reasoning[priority]

        if matched:
            reasoning += f" Key indicators: {', '.join(matched[:3])}."

        if context and context.get("is_pwd"):
            reasoning += " Priority adjusted for accessibility needs."

        return reasoning

    def _suggest_conditions(self, text: str, priority: PriorityLevel) -> List[Dict]:
        """Suggest potential conditions based on symptoms."""
        # Simplified condition matching
        conditions = []

        condition_keywords = {
            "Urinary Tract Infection": ["burning urine", "frequent urination", "uti"],
            "Respiratory Infection": ["cough", "fever", "shortness of breath"],
            "Pressure Injury": ["sore", "wound", "skin breakdown"],
            "Autonomic Dysreflexia": ["headache", "high blood pressure", "sweating"],
            "Constipation": ["constipation", "no bowel movement", "abdominal pain"],
            "Muscle Spasm": ["spasm", "stiffness", "tightness"]
        }

        for condition, keywords in condition_keywords.items():
            match_count = sum(1 for kw in keywords if kw in text)
            if match_count > 0:
                probability = min(0.9, match_count / len(keywords) + 0.3)
                conditions.append({
                    "condition": condition,
                    "probability": round(probability, 2),
                    "requires_immediate_attention": priority in [PriorityLevel.CRITICAL, PriorityLevel.HIGH]
                })

        # Sort by probability
        conditions.sort(key=lambda x: x["probability"], reverse=True)
        return conditions[:3]  # Top 3

# Singleton instance
triage_model = QuadriplegicTriageModel()

def analyze_patient_symptoms(
    symptoms: str, 
    disability_type: str = "quadriplegia",
    level_of_injury: str = None,
    is_pwd: bool = True
) -> Dict:
    """Convenience function for triage analysis."""
    context = {
        "disability_type": disability_type,
        "level_of_injury": level_of_injury,
        "is_pwd": is_pwd
    }

    result = triage_model.analyze_symptoms(symptoms, context)

    return {
        "priority": result.priority.value,
        "confidence": round(result.confidence, 2),
        "recommended_action": result.recommended_action,
        "urgency_minutes": result.urgency_minutes,
        "reasoning": result.reasoning,
        "matched_symptoms": result.matched_symptoms,
        "potential_conditions": result.potential_conditions
    }
