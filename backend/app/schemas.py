from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    role: Literal["teacher", "student"]
    teacher_code: str | None = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GenerateIn(BaseModel):
    num_questions: int = Field(default=10, ge=1, le=50)
    topic: str | None = Field(default=None, max_length=200)
    difficulty: Literal["easy", "medium", "hard"] = "medium"


class OptionIn(BaseModel):
    id: str
    text: str = Field(min_length=1)


class QuestionUpdate(BaseModel):
    question: str = Field(min_length=1)
    options: list[OptionIn] = Field(min_length=2, max_length=6)
    correct_option_id: str
    explanation: str = ""


class ExamCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    question_ids: list[str] = Field(min_length=1)
    duration_minutes: int = Field(default=30, ge=1, le=600)
    marks_per_question: float = Field(default=1, gt=0)
    auto_publish: bool = False
    student_ids: list[str] = []


class AssignIn(BaseModel):
    student_ids: list[str]


class Violation(BaseModel):
    type: str
    at: datetime


class SubmitIn(BaseModel):
    answers: dict[str, str]  # question_id -> option_id
    offline_started_at: datetime | None = None
    submitted_at: datetime
    violations: list[Violation] = []


class GradeIn(BaseModel):
    final_score: float = Field(ge=0)
    remarks: str = ""
    published: bool = True
