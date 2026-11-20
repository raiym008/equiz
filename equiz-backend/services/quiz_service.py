import random
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy.orm import Session

import config
from database import as_utc
from models import Deck, QuizAttempt
from security import generate_attempt_token, verify_attempt_token
from schemas import (
    QuizSessionOut,
    QuizItemPublic,
    McqPublicPayload,
    QuizSubmitRequest,
    QuizAttemptOut,
    QuizQuestionResult,
)


def _build_public_items(deck: Deck, ordered_ids: list[str]) -> list[QuizItemPublic]:
    mcq_map = {i.id: i for i in deck.items if i.item_type == "mcq"}
    result = []
    for item_id in ordered_ids:
        item = mcq_map.get(item_id)
        if not item:
            continue
        p = item.payload
        result.append(
            QuizItemPublic(
                id=item.id,
                order_index=item.order_index,
                points=item.points,
                payload=McqPublicPayload(
                    question=p["question"],
                    options=p["options"],
                    is_multi=len(p.get("correct_keys", [])) > 1,
                ),
            )
        )
    return result


def _calc_remaining_seconds(deck: Deck, started_at: datetime) -> int | None:
    limit = (deck.settings or {}).get("time_limit_sec")
    if not limit:
        return None
    start_utc = as_utc(started_at)
    elapsed = (datetime.now(timezone.utc) - start_utc).total_seconds()
    return max(0, int(limit - elapsed))


def start_participant_attempt(
    db: Session, share_code: str, participant_name: str
) -> QuizSessionOut:
    deck = (
        db.query(Deck)
        .filter(Deck.share_code == share_code, Deck.is_archived.is_(False))
        .first()
    )
    if not deck:
        raise HTTPException(status_code=404, detail="Тест сілтемесі табылмады")
    if not deck.is_active:
        raise HTTPException(status_code=403, detail="Бұл тест қазір жабық")

    mcq_items = [i for i in deck.items if i.item_type == "mcq"]
    if not mcq_items:
        raise HTTPException(status_code=400, detail="Бұл тестте сұрақтар жоқ")

    # Сұрақтарды араластырып, сол ретті сессияға бекітеміз
    shuffled_ids = [i.id for i in mcq_items]
    random.shuffle(shuffled_ids)

    raw_token, token_hash = generate_attempt_token()
    now_utc = datetime.now(timezone.utc)

    max_score = sum(i.points for i in mcq_items)

    # Бірдей атпен 10 адам кірсе де, әрқайсысына бірегей attempt_id жасалады
    attempt = QuizAttempt(
        deck_id=deck.id,
        participant_name=participant_name,
        token_hash=token_hash,
        status="in_progress",
        question_order=shuffled_ids,
        score=0,
        max_score=max_score,
        started_at=now_utc,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    return QuizSessionOut(
        attempt_id=attempt.id,
        session_token=raw_token,
        participant_name=attempt.participant_name,
        status=attempt.status,
        deck_id=deck.id,
        title=deck.title,
        settings=deck.settings,
        started_at=as_utc(attempt.started_at),
        remaining_seconds=_calc_remaining_seconds(deck, attempt.started_at),
        items=_build_public_items(deck, shuffled_ids),
    )


def resume_participant_attempt(
    db: Session, attempt_id: str, session_token: str | None
) -> QuizSessionOut:
    """Қатысушы бетті кездейсоқ жаңартып жіберсе, сол сессияны жалғастырады."""
    attempt = db.query(QuizAttempt).filter(QuizAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Тест сессиясы табылмады")

    if not verify_attempt_token(session_token, attempt.token_hash):
        raise HTTPException(status_code=403, detail="Сессия токені жарамсыз")

    if attempt.status == "completed":
        raise HTTPException(status_code=409, detail="Бұл тест әрекеті аяқталған")

    deck = attempt.deck
    ordered_ids = attempt.question_order or [
        i.id for i in deck.items if i.item_type == "mcq"
    ]

    return QuizSessionOut(
        attempt_id=attempt.id,
        session_token=None,
        participant_name=attempt.participant_name,
        status=attempt.status,
        deck_id=deck.id,
        title=deck.title,
        settings=deck.settings,
        started_at=as_utc(attempt.started_at),
        remaining_seconds=_calc_remaining_seconds(deck, attempt.started_at),
        items=_build_public_items(deck, ordered_ids),
    )


def format_attempt_out(attempt: QuizAttempt) -> QuizAttemptOut:
    start_utc = as_utc(attempt.started_at)
    end_utc = as_utc(attempt.finished_at)
    duration = None
    if start_utc and end_utc:
        duration = max(0, int((end_utc - start_utc).total_seconds()))

    return QuizAttemptOut(
        attempt_id=attempt.id,
        participant_name=attempt.participant_name,
        status=attempt.status,
        is_late=attempt.is_late,
        deck_id=attempt.deck_id,
        deck_title=attempt.deck.title if attempt.deck else "Тест",
        score=attempt.score,
        max_score=attempt.max_score,
        started_at=start_utc,
        finished_at=end_utc,
        duration_seconds=duration,
        details=[QuizQuestionResult(**d) for d in (attempt.details or [])],
    )


def submit_participant_attempt(
    db: Session,
    attempt_id: str,
    req: QuizSubmitRequest,
    session_token: str | None,
) -> QuizAttemptOut:
    attempt = db.query(QuizAttempt).filter(QuizAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Тест сессиясы табылмады")

    if not verify_attempt_token(session_token, attempt.token_hash):
        raise HTTPException(status_code=403, detail="Сессия токені жарамсыз")

    # Идемпотенттілік: егер батырма екі рет басылса, қате бермей дайын нәтижені қайтарамыз
    if attempt.status == "completed":
        return format_attempt_out(attempt)

    deck = attempt.deck
    mcq_items = {i.id: i for i in deck.items if i.item_type == "mcq"}

    now_utc = datetime.now(timezone.utc)
    start_utc = as_utc(attempt.started_at)
    limit_sec = (deck.settings or {}).get("time_limit_sec")
    is_late = False
    if limit_sec and start_utc:
        elapsed = (now_utc - start_utc).total_seconds()
        if elapsed > (limit_sec + config.SUBMIT_GRACE_SECONDS):
            is_late = True

    submitted_map = {a.item_id: a.selected_keys for a in req.answers}
    ordered_ids = list(attempt.question_order or [])
    for item_id in mcq_items:
        if item_id not in ordered_ids:
            ordered_ids.append(item_id)

    total_score = 0
    max_score = 0
    details: list[dict] = []

    for item_id in ordered_ids:
        item = mcq_items.get(item_id)
        if not item:
            continue
        p = item.payload
        correct_keys = sorted(set(p.get("correct_keys", [])))
        selected_keys = sorted(set(submitted_map.get(item_id, [])))

        is_correct = len(correct_keys) > 0 and selected_keys == correct_keys
        points_earned = item.points if is_correct else 0

        total_score += points_earned
        max_score += item.points

        details.append(
            QuizQuestionResult(
                item_id=item_id,
                question=p["question"],
                options=p["options"],
                selected_keys=selected_keys,
                correct_keys=correct_keys,
                points_earned=points_earned,
                max_points=item.points,
                is_correct=is_correct,
            ).model_dump()
        )

    attempt.score = total_score
    attempt.max_score = max_score
    attempt.details = details
    attempt.status = "completed"
    attempt.finished_at = now_utc
    attempt.is_late = is_late

    db.commit()
    db.refresh(attempt)

    return format_attempt_out(attempt)