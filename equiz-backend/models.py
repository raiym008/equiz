import uuid
import secrets
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base

JSONType = JSONB().with_variant(JSON(), "sqlite")


def _uuid() -> str:
    return str(uuid.uuid4())


def _share_code() -> str:
    return secrets.token_urlsafe(6)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Deck(Base):
    __tablename__ = "decks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    share_code: Mapped[str] = mapped_column(
        String(24), unique=True, index=True, nullable=False, default=_share_code
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Сілтемені уақытша жабу/ашу және қауіпсіз өшіру (Soft Delete)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)

    settings: Mapped[dict] = mapped_column(
        JSONType, nullable=False, default=lambda: {"time_limit_sec": None}
    )
    # Болашақта миграциясыз жаңа өрістер қосуға арналған әмбебап контейнер
    meta: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    items: Mapped[list["StudyItem"]] = relationship(
        "StudyItem",
        back_populates="deck",
        cascade="all, delete-orphan",
        order_by="StudyItem.order_index",
    )
    attempts: Mapped[list["QuizAttempt"]] = relationship(
        "QuizAttempt", back_populates="deck"
    )


class StudyItem(Base):
    __tablename__ = "study_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    deck_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("decks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    item_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    points: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    payload: Mapped[dict] = mapped_column(JSONType, nullable=False)

    deck: Mapped["Deck"] = relationship("Deck", back_populates="items")
    progress: Mapped["FlashcardProgress | None"] = relationship(
        "FlashcardProgress",
        back_populates="item",
        uselist=False,
        cascade="all, delete-orphan",
    )


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    # Әр тапсыру әрекетінің бірегей ID-і (аттар қайталанса да, нәтижелер ешқашан бірікпейді)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    deck_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("decks.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Тек қатысушы енгізген ат (жеке деректер жоқ)
    participant_name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Сессияны бөтен адамның бұзуынан қорғайтын хэш-токен
    token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # "in_progress" | "completed"
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="in_progress", index=True)

    # Бетті жаңартқанда сұрақтардың бастапқы ретін сақтап тұру үшін
    question_order: Mapped[list] = mapped_column(JSONType, nullable=False, default=list)

    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    details: Mapped[list] = mapped_column(JSONType, nullable=False, default=list)

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_late: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    meta: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)

    deck: Mapped["Deck"] = relationship("Deck", back_populates="attempts")


class FlashcardProgress(Base):
    __tablename__ = "flashcard_progress"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    deck_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("decks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("study_items.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="new")
    review_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    item: Mapped["StudyItem"] = relationship("StudyItem", back_populates="progress")