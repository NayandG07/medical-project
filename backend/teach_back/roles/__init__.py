"""
LLM role implementations for teach-back sessions.

Each role provides specialized behavior for different session phases:
- StudentPersona: Acts as curious learner being taught
- Evaluator: Detects errors and triggers interruptions
- Controller: Manages session flow and state transitions
- Examiner: Conducts oral examination phase
"""

from .student_persona import StudentPersona
from .evaluator import Evaluator
from .controller import Controller
from .examiner import Examiner

__all__ = ["StudentPersona", "Evaluator", "Controller", "Examiner"]
