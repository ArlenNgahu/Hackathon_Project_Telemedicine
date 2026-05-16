"""
Virtual Queue Algorithm with Two-Layer Priority System
Optimized for Quadriplegic Patients - Accessibility + Clinical Urgency
"""

import heapq
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from enum import Enum
import threading
import time

class PriorityLevel(Enum):
    CRITICAL = 1
    HIGH = 2
    MEDIUM = 3
    LOW = 4

class AccessibilityPriority(Enum):
    NONE = 0
    STANDARD_PWD = 1  # Person with disability
    URGENT_PWD = 2    # PWD with high clinical need
    CRITICAL_PWD = 3  # PWD with critical condition

@dataclass(order=True)
class QueueItem:
    """
    Queue item with composite scoring.
    Lower composite_score = higher priority.
    """
    composite_score: float = field(compare=True)

    # Data fields (not compared)
    ticket_id: str = field(compare=False)
    patient_id: str = field(compare=False)
    patient_name: str = field(compare=False)
    clinical_priority: PriorityLevel = field(compare=False)
    accessibility_priority: AccessibilityPriority = field(compare=False)
    is_pwd: bool = field(compare=False)
    arrival_time: datetime = field(compare=False)
    estimated_service_time: int = field(compare=False, default=20)  # minutes

    # Dynamic fields
    current_position: int = field(compare=False, default=0)
    estimated_wait_minutes: int = field(compare=False, default=0)
    eta: Optional[datetime] = field(compare=False, default=None)

    # Status
    status: str = field(compare=False, default="waiting")  # waiting, called, serving, completed
    teleconsult_eligible: bool = field(compare=False, default=False)
    teleconsult_offered: bool = field(compare=False, default=False)

class SmartVirtualQueue:
    """
    Virtual queue implementing two-layer priority:
    1. Clinical urgency (CRITICAL > HIGH > MEDIUM > LOW)
    2. Accessibility priority (PWDs within same clinical tier)

    Features:
    - Dynamic ETA calculation based on throughput
    - Automatic teleconsult promotion for long waits
    - Fairness: Equal access, not preferential clinical treatment
    """

    def __init__(self):
        # Priority queue (min-heap)
        self._queue: List[QueueItem] = []
        self._lock = threading.RLock()

        # Statistics for ETA calculation
        self.avg_service_time = 20  # minutes
        self.doctor_count = 3
        self.throughput_per_hour = 9  # 60/20 * 3

        # Tracking
        self._ticket_counter = 0
        self._served_count = 0
        self._total_wait_time = 0

        # Teleconsult threshold
        self.teleconsult_threshold_minutes = 45
        self.teleconsult_max_priority = PriorityLevel.MEDIUM

    def _calculate_composite_score(
        self,
        clinical: PriorityLevel,
        accessibility: AccessibilityPriority,
        arrival_time: datetime
    ) -> float:
        """
        Calculate composite priority score.

        Formula:
        Score = (Clinical Tier × 10) + (Accessibility Boost) + (Time Factor)

        Where:
        - Clinical Tier: 1=Critical, 2=High, 3=Medium, 4=Low
        - Accessibility Boost: -0.5 for PWDs (within same tier)
        - Time Factor: Microseconds since epoch (ensures FIFO within tier)

        This ensures:
        1. Clinical urgency ALWAYS takes precedence
        2. PWDs get priority accommodation within same clinical level
        3. Earlier arrivals served first within same priority tier
        """
        # Base clinical score (dominant factor)
        clinical_score = clinical.value * 10

        # Accessibility boost (only within same clinical tier)
        # Critical PWDs still behind non-PWD Critical cases clinically,
        # but we boost them slightly for accommodation
        accessibility_boost = 0
        if accessibility == AccessibilityPriority.CRITICAL_PWD:
            accessibility_boost = -0.3
        elif accessibility == AccessibilityPriority.URGENT_PWD:
            accessibility_boost = -0.2
        elif accessibility == AccessibilityPriority.STANDARD_PWD:
            accessibility_boost = -0.1

        # Time factor (microseconds, ensures FIFO)
        # Divide by large number to make it negligible compared to clinical
        time_factor = arrival_time.timestamp() / 1e10

        return clinical_score + accessibility_boost + time_factor

    def add_patient(
        self,
        patient_id: str,
        patient_name: str,
        clinical_priority: PriorityLevel,
        is_pwd: bool = False,
        accessibility_priority: AccessibilityPriority = AccessibilityPriority.NONE,
        estimated_service_time: int = 20
    ) -> QueueItem:
        """
        Add patient to virtual queue.

        Args:
            patient_id: Unique patient identifier
            patient_name: Display name
            clinical_priority: Medical urgency level
            is_pwd: Person with disability flag
            accessibility_priority: PWD accommodation level
            estimated_service_time: Expected consultation duration

        Returns:
            QueueItem with position and ETA
        """
        with self._lock:
            self._ticket_counter += 1
            ticket_id = f"Q{datetime.now().strftime('%Y%m%d')}-{self._ticket_counter:04d}"

            arrival_time = datetime.now()

            # Calculate composite score
            composite_score = self._calculate_composite_score(
                clinical_priority,
                accessibility_priority,
                arrival_time
            )

            # Determine teleconsult eligibility
            teleconsult_eligible = (
                clinical_priority in [PriorityLevel.LOW, PriorityLevel.MEDIUM] and
                not is_pwd  # PWDs may need physical exam
            )

            item = QueueItem(
                composite_score=composite_score,
                ticket_id=ticket_id,
                patient_id=patient_id,
                patient_name=patient_name,
                clinical_priority=clinical_priority,
                accessibility_priority=accessibility_priority,
                is_pwd=is_pwd,
                arrival_time=arrival_time,
                estimated_service_time=estimated_service_time,
                teleconsult_eligible=teleconsult_eligible
            )

            # Add to priority queue
            heapq.heappush(self._queue, item)

            # Recalculate all positions and ETAs
            self._update_queue_positions()

            return item

    def _update_queue_positions(self):
        """Update position numbers and ETAs for all queue items."""
        if not self._queue:
            return

        # Sort by priority (without removing from heap)
        sorted_items = sorted(self._queue)

        cumulative_time = 0
        for i, item in enumerate(sorted_items):
            item.current_position = i + 1

            # Calculate ETA
            # Formula: (position / doctors) * avg_service_time
            estimated_wait = int((i / self.doctor_count) * self.avg_service_time)

            # Critical patients seen immediately (within 15 min)
            if item.clinical_priority == PriorityLevel.CRITICAL:
                estimated_wait = min(estimated_wait, 15)

            item.estimated_wait_minutes = estimated_wait
            item.eta = datetime.now() + timedelta(minutes=estimated_wait)

            # Offer teleconsult if wait is too long and eligible
            if (estimated_wait > self.teleconsult_threshold_minutes and 
                item.teleconsult_eligible and 
                not item.teleconsult_offered):
                item.teleconsult_offered = True

    def get_next_patient(self) -> Optional[QueueItem]:
        """Get highest priority patient from queue."""
        with self._lock:
            if not self._queue:
                return None

            # Get highest priority (lowest score)
            item = heapq.heappop(self._queue)
            item.status = "called"

            # Update statistics
            self._served_count += 1
            wait_time = (datetime.now() - item.arrival_time).total_seconds() / 60
            self._total_wait_time += wait_time
            self.avg_service_time = self._total_wait_time / self._served_count

            # Recalculate remaining positions
            self._update_queue_positions()

            return item

    def get_queue_status(self, ticket_id: Optional[str] = None) -> Dict:
        """Get current queue status."""
        with self._lock:
            sorted_queue = sorted(self._queue)

            status = {
                "total_waiting": len(self._queue),
                "estimated_throughput_per_hour": self.throughput_per_hour,
                "average_wait_minutes": self.avg_service_time,
                "by_priority": {
                    "CRITICAL": len([i for i in sorted_queue if i.clinical_priority == PriorityLevel.CRITICAL]),
                    "HIGH": len([i for i in sorted_queue if i.clinical_priority == PriorityLevel.HIGH]),
                    "MEDIUM": len([i for i in sorted_queue if i.clinical_priority == PriorityLevel.MEDIUM]),
                    "LOW": len([i for i in sorted_queue if i.clinical_priority == PriorityLevel.LOW])
                },
                "pwd_accommodations": len([i for i in sorted_queue if i.is_pwd]),
                "teleconsult_offers_available": len([i for i in sorted_queue if i.teleconsult_offered and not i.teleconsult_eligible])
            }

            if ticket_id:
                for item in sorted_queue:
                    if item.ticket_id == ticket_id:
                        status["your_ticket"] = {
                            "ticket_id": item.ticket_id,
                            "position": item.current_position,
                            "estimated_wait_minutes": item.estimated_wait_minutes,
                            "eta": item.eta.isoformat() if item.eta else None,
                            "clinical_priority": item.clinical_priority.name,
                            "is_pwd": item.is_pwd,
                            "teleconsult_offered": item.teleconsult_offered
                        }
                        break

            return status

    def accept_teleconsult(self, ticket_id: str) -> bool:
        """Patient accepts teleconsult offer - remove from physical queue."""
        with self._lock:
            for i, item in enumerate(self._queue):
                if item.ticket_id == ticket_id and item.teleconsult_eligible:
                    item.teleconsult_offered = True
                    item.status = "teleconsult"

                    # Remove from physical queue
                    self._queue.pop(i)
                    heapq.heapify(self._queue)
                    self._update_queue_positions()

                    return True
            return False

    def cancel_ticket(self, ticket_id: str) -> bool:
        """Cancel a queue ticket."""
        with self._lock:
            for i, item in enumerate(self._queue):
                if item.ticket_id == ticket_id:
                    self._queue.pop(i)
                    heapq.heapify(self._queue)
                    self._update_queue_positions()
                    return True
            return False

    def get_fairness_metrics(self) -> Dict:
        """
        Calculate fairness metrics to ensure PWDs are accommodated
        without disadvantaging others.
        """
        with self._lock:
            sorted_queue = sorted(self._queue)

            # Calculate average wait by category
            pwd_waits = []
            non_pwd_waits = []

            for i, item in enumerate(sorted_queue):
                wait = item.estimated_wait_minutes
                if item.is_pwd:
                    pwd_waits.append(wait)
                else:
                    non_pwd_waits.append(wait)

            avg_pwd_wait = sum(pwd_waits) / len(pwd_waits) if pwd_waits else 0
            avg_non_pwd_wait = sum(non_pwd_waits) / len(non_pwd_waits) if non_pwd_waits else 0

            return {
                "average_wait_pwd_minutes": round(avg_pwd_wait, 1),
                "average_wait_non_pwd_minutes": round(avg_non_pwd_wait, 1),
                "wait_difference": round(avg_pwd_wait - avg_non_pwd_wait, 1),
                "pwd_count": len(pwd_waits),
                "non_pwd_count": len(non_pwd_waits),
                "fairness_assessment": "Equitable" if abs(avg_pwd_wait - avg_non_pwd_wait) < 10 else "Review needed"
            }

# Global queue instance
virtual_queue = SmartVirtualQueue()

def add_patient_to_queue(
    patient_id: str,
    patient_name: str,
    priority: str,
    is_pwd: bool = False
) -> Dict:
    """Convenience function to add patient to queue."""

    priority_map = {
        "critical": PriorityLevel.CRITICAL,
        "high": PriorityLevel.HIGH,
        "medium": PriorityLevel.MEDIUM,
        "low": PriorityLevel.LOW
    }

    clinical_priority = priority_map.get(priority.lower(), PriorityLevel.MEDIUM)

    # Determine accessibility priority
    if is_pwd:
        if clinical_priority == PriorityLevel.CRITICAL:
            accessibility = AccessibilityPriority.CRITICAL_PWD
        elif clinical_priority == PriorityLevel.HIGH:
            accessibility = AccessibilityPriority.URGENT_PWD
        else:
            accessibility = AccessibilityPriority.STANDARD_PWD
    else:
        accessibility = AccessibilityPriority.NONE

    item = virtual_queue.add_patient(
        patient_id=patient_id,
        patient_name=patient_name,
        clinical_priority=clinical_priority,
        is_pwd=is_pwd,
        accessibility_priority=accessibility
    )

    return {
        "ticket_id": item.ticket_id,
        "position": item.current_position,
        "estimated_wait_minutes": item.estimated_wait_minutes,
        "eta": item.eta.isoformat() if item.eta else None,
        "teleconsult_offered": item.teleconsult_offered,
        "message": f"You are position {item.current_position} in queue. "
                   f"Estimated wait: {item.estimated_wait_minutes} minutes."
    }
