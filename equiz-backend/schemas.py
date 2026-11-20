from datetime import datetime
from typing import Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field, field_validator, model_validator


class McqPayload(BaseModel):
    question: str = Field(..., min_length=1)
    options: Dict[str, str] = Field(..., min_length=2)
    correct_keys: List[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_correct_keys(self) -> "McqPayload":
        invalid = [k for k in self.correct_keys if k not in self.options]
        if invalid:
            raise ValueError(f"Дұрыс жауап кілттері нұсқаларда жоқ: {invalid}")
        return self


class McqPublicPayload(BaseModel):
    question: str
    options: Dict[str, str]
    is_multi: bool


class FlashcardPayload(BaseModel):
    front: str = Field(..., min_length=1)
    back: str = Field(..., min_length=1)


class StudyItemCreate(BaseModel):
    item_type: Literal["mcq", "flashcard"]
    points: int = Field(default=1, ge=1, le=10)
    payload: Union[McqPayload, FlashcardPayload]

    @model_validator(mode="after")
    def validate_payload_matches_type(self) -> "StudyItemCreate":
        if self.item_type == "mcq" and not isinstance(self.payload, McqPayload):
            raise ValueError("item_type='mcq' үшін McqPayload қажет")
        if self.item_type == "flashcard" and not isinstance(self.payload, FlashcardPayload):
            raise ValueError("item_type='flashcard' үшін FlashcardPayload қажет")
        return self


class StudyItemOut(StudyItemCreate):
    id: str
    order_index: int


class DeckSettings(BaseModel):
    time_limit_sec: Optional[int] = Field(default=None, ge=10)


class DeckCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    is_active: bool = True
    settings: DeckSettings = Field(default_factory=DeckSettings)
    items: List[StudyItemCreate] = Field(..., min_length=1)


class DeckOut(BaseModel):
    id: str
    share_code: str
    title: str
    description: Optional[str]
    is_active: bool
    settings: DeckSettings
    created_at: datetime
    items: List[StudyItemOut]


class DeckSummary(BaseModel):
    id: str
    share_code: str
    title: str
    description: Optional[str]
    is_active: bool
    item_count: int
    mcq_count: int
    flashcard_count: int
    attempt_count: int
    created_at: datetime


# --- ҚАТЫСУШЫЛАРДЫҢ СІЛТЕМЕ АРҚЫЛЫ КІРУІ ---
class SharedQuizInfo(BaseModel):
    share_code: str
    title: str
    description: Optional[str]
    question_count: int
    time_limit_sec: Optional[int]
    is_active: bool


class QuizStartRequest(BaseModel):
    participant_name: str = Field(..., min_length=1, max_length=100)

    @field_validator("participant_name")
    @classmethod
    def sanitize_name(cls, v: str) -> str:
        # Артық бос орындар мен басқару таңбаларын тазалау
        cleaned = " ".join(v.strip().split())
        if not cleaned:
            raise ValueError("Атыңызды енгізіңіз")
        return cleaned


class QuizItemPublic(BaseModel):
    id: str
    order_index: int
    points: int
    payload: McqPublicPayload


class QuizSessionOut(BaseModel):
    attempt_id: str
    session_token: Optional[str] = None  # Жаңа басталғанда беріледі (browser sessionStorage-де сақталады)
    participant_name: str
    status: str
    deck_id: str
    title: str
    settings: DeckSettings
    started_at: datetime
    remaining_seconds: Optional[int] = None
    items: List[QuizItemPublic]


class QuizAnswerSubmit(BaseModel):
    item_id: str
    selected_keys: List[str]


class QuizSubmitRequest(BaseModel):
    answers: List[QuizAnswerSubmit]


class QuizQuestionResult(BaseModel):
    item_id: str
    question: str
    options: Dict[str, str]
    selected_keys: List[str]
    correct_keys: List[str]
    points_earned: int
    max_points: int
    is_correct: bool


class QuizAttemptOut(BaseModel):
    attempt_id: str
    participant_name: str
    status: str
    is_late: bool
    deck_id: str
    deck_title: str
    score: Optional[int]
    max_score: Optional[int]
    started_at: datetime
    finished_at: Optional[datetime]
    duration_seconds: Optional[int]
    details: List[QuizQuestionResult]


# --- КАРТОЧКАЛАР (FLASHCARDS) ---
class FlashcardStudyItem(BaseModel):
    id: str
    order_index: int
    front: str
    back: str
    status: Literal["new", "known", "review"]
    review_count: int


class FlashcardMarkRequest(BaseModel):
    status: Literal["known", "review"]