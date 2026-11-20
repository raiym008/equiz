import os
import time
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

import config
from database import get_db
from models import Deck, StudyItem, QuizAttempt, FlashcardProgress
from parser import parse_universal_equiz
from security import require_admin, start_quiz_limiter
from services.quiz_service import (
    start_participant_attempt,
    resume_participant_attempt,
    submit_participant_attempt,
    format_attempt_out,
)
from schemas import (
    DeckCreate,
    DeckOut,
    DeckSummary,
    StudyItemCreate,
    StudyItemOut,
    SharedQuizInfo,
    QuizStartRequest,
    QuizSessionOut,
    QuizSubmitRequest,
    QuizAttemptOut,
    FlashcardStudyItem,
    FlashcardMarkRequest,
)

router = APIRouter(prefix="/api")


class AnswerCheckRequest(BaseModel):
    item_id: str
    selected_keys: list[str] = []


def _deck_to_out(deck: Deck) -> DeckOut:
    return DeckOut(
        id=deck.id,
        share_code=deck.share_code,
        title=deck.title,
        description=deck.description,
        is_active=deck.is_active,
        settings=deck.settings,
        created_at=deck.created_at,
        items=[
            StudyItemOut(
                id=item.id,
                order_index=item.order_index,
                item_type=item.item_type,
                points=item.points,
                payload=item.payload,
            )
            for item in deck.items
        ],
    )


# =====================================================================
# 1. ҚАТЫСУШЫЛАРҒА АРНАЛҒАН АШЫҚ МАРШРУТТАР (ТЕК АТЫМЕН КІРУ)
# =====================================================================

@router.get("/public/quizzes/{share_code}", response_model=SharedQuizInfo)
def get_public_quiz_info(share_code: str, db: Session = Depends(get_db)):
    """1-қадам: Қатысушы сілтемені ашқанда тест атауы мен қысқаша ақпаратын көреді."""
    deck = (
        db.query(Deck)
        .filter(Deck.share_code == share_code, Deck.is_archived.is_(False))
        .first()
    )
    if not deck:
        raise HTTPException(status_code=404, detail="Тест сілтемесі табылмады")

    mcq_count = sum(1 for i in deck.items if i.item_type == "mcq")
    return SharedQuizInfo(
        share_code=deck.share_code,
        title=deck.title,
        description=deck.description,
        question_count=mcq_count,
        time_limit_sec=(deck.settings or {}).get("time_limit_sec"),
        is_active=deck.is_active,
    )


@router.post(
    "/public/quizzes/{share_code}/start",
    response_model=QuizSessionOut,
    dependencies=[Depends(start_quiz_limiter)],
)
def start_public_quiz(
    share_code: str,
    req: QuizStartRequest,
    db: Session = Depends(get_db),
):
    """2-қадам: Қатысушы тек атын енгізеді -> бірегей attempt_id жасалып тест басталады."""
    return start_participant_attempt(db, share_code, req.participant_name)


@router.get("/public/attempts/{attempt_id}", response_model=QuizSessionOut)
def resume_public_attempt(
    attempt_id: str,
    x_attempt_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    """Бетті кездейсоқ жаңартып жіберген жағдайда сессияны қалпына келтіру."""
    return resume_participant_attempt(db, attempt_id, x_attempt_token)


@router.post("/public/attempts/{attempt_id}/submit", response_model=QuizAttemptOut)
def submit_public_attempt(
    attempt_id: str,
    req: QuizSubmitRequest,
    x_attempt_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    """3-қадам: Тестті аяқтау және бірегей attempt_id бойынша бағалау."""
    return submit_participant_attempt(db, attempt_id, req, x_attempt_token)


# =====================================================================
# 2. ӘКІМШІ / МҰҒАЛІМ ПАНЕЛІ МАРШРУТТАРЫ
# =====================================================================

@router.post(
    "/decks/parse",
    response_model=list[StudyItemCreate],
    dependencies=[Depends(require_admin)],
)
def parse_deck_file(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Тек .docx форматындағы файлды жүктеңіз")

    # Файл өлшемін тексеру
    file.file.seek(0, os.SEEK_END)
    size_bytes = file.file.tell()
    file.file.seek(0)
    if size_bytes > config.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"Файл өлшемі {config.MAX_UPLOAD_SIZE_MB} МБ-тан аспауы керек",
        )

    safe_filename = f"{int(time.time())}_{os.path.basename(file.filename)}"
    file_path = os.path.join(config.UPLOAD_DIR, safe_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        parsed_items = parse_universal_equiz(file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Файлды талдау қатесі: {str(e)}")
    finally:
        # Сервер дискісі толып қалмауы үшін уақытша файлды өшіреміз
        if os.path.exists(file_path):
            os.remove(file_path)

    if not parsed_items:
        raise HTTPException(status_code=400, detail="Файл ішінен тест сұрақтары табылмады")

    return parsed_items


@router.get("/decks", response_model=list[DeckSummary], dependencies=[Depends(require_admin)])
def list_decks(db: Session = Depends(get_db)):
    decks = (
        db.query(Deck)
        .filter(Deck.is_archived.is_(False))
        .order_by(Deck.created_at.desc())
        .all()
    )
    summaries = []
    for d in decks:
        mcq_count = sum(1 for i in d.items if i.item_type == "mcq")
        fc_count = sum(1 for i in d.items if i.item_type == "flashcard")
        summaries.append(
            DeckSummary(
                id=d.id,
                share_code=d.share_code,
                title=d.title,
                description=d.description,
                is_active=d.is_active,
                item_count=len(d.items),
                mcq_count=mcq_count,
                flashcard_count=fc_count,
                attempt_count=len(d.attempts),
                created_at=d.created_at,
            )
        )
    return summaries


@router.post(
    "/decks",
    response_model=DeckOut,
    status_code=201,
    dependencies=[Depends(require_admin)],
)
def create_deck(payload: DeckCreate, db: Session = Depends(get_db)):
    deck = Deck(
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        is_active=payload.is_active,
        settings=payload.settings.model_dump(),
    )
    for idx, item in enumerate(payload.items):
        deck.items.append(
            StudyItem(
                order_index=idx,
                item_type=item.item_type,
                points=item.points,
                payload=item.payload.model_dump(),
            )
        )
    db.add(deck)
    db.commit()
    db.refresh(deck)
    return _deck_to_out(deck)


@router.get("/decks/{deck_id}", response_model=DeckOut, dependencies=[Depends(require_admin)])
def get_deck(deck_id: str, db: Session = Depends(get_db)):
    deck = db.query(Deck).filter(Deck.id == deck_id, Deck.is_archived.is_(False)).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Материал табылмады")
    return _deck_to_out(deck)


@router.put("/decks/{deck_id}", response_model=DeckOut, dependencies=[Depends(require_admin)])
def update_deck(deck_id: str, payload: DeckCreate, db: Session = Depends(get_db)):
    deck = db.query(Deck).filter(Deck.id == deck_id, Deck.is_archived.is_(False)).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Материал табылмады")

    deck.title = payload.title.strip()
    deck.description = payload.description.strip() if payload.description else None
    deck.is_active = payload.is_active
    deck.settings = payload.settings.model_dump()

    deck.items.clear()
    db.flush()

    for idx, item in enumerate(payload.items):
        deck.items.append(
            StudyItem(
                order_index=idx,
                item_type=item.item_type,
                points=item.points,
                payload=item.payload.model_dump(),
            )
        )

    db.commit()
    db.refresh(deck)
    return _deck_to_out(deck)


@router.delete("/decks/{deck_id}", dependencies=[Depends(require_admin)])
def archive_deck(deck_id: str, db: Session = Depends(get_db)):
    """Soft Delete: бұрынғы студенттердің нәтижелері жоғалып кетпеуі үшін тест мұрағатталады."""
    deck = db.query(Deck).filter(Deck.id == deck_id, Deck.is_archived.is_(False)).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Материал табылмады")
    deck.is_archived = True
    deck.is_active = False
    db.commit()
    return {"message": "Материал мұрағатталды (нәтижелер сақталды)", "deck_id": deck_id}


@router.get(
    "/decks/{deck_id}/results",
    response_model=list[QuizAttemptOut],
    dependencies=[Depends(require_admin)],
)
def list_deck_results(deck_id: str, db: Session = Depends(get_db)):
    """Әкімші панелі: әр қатысушының аты, attempt_id, бастаған/аяқтаған уақыты және жауаптары."""
    deck = db.query(Deck).filter(Deck.id == deck_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Материал табылмады")

    attempts = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.deck_id == deck_id)
        .order_by(QuizAttempt.started_at.desc())
        .all()
    )
    return [format_attempt_out(a) for a in attempts]


@router.get(
    "/results/{attempt_id}",
    response_model=QuizAttemptOut,
    dependencies=[Depends(require_admin)],
)
def get_result_by_id(attempt_id: str, db: Session = Depends(get_db)):
    attempt = db.query(QuizAttempt).filter(QuizAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(status_code=404, detail="Нәтиже табылмады")
    return format_attempt_out(attempt)


# --- КАРТОЧКАЛАР (FLASHCARDS) ---
@router.get("/decks/{deck_id}/flashcards", response_model=list[FlashcardStudyItem])
def get_flashcards(deck_id: str, only_review: bool = False, db: Session = Depends(get_db)):
    deck = db.query(Deck).filter(Deck.id == deck_id, Deck.is_archived.is_(False)).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Материал табылмады")

    fc_items = [i for i in deck.items if i.item_type == "flashcard"]
    result: list[FlashcardStudyItem] = []

    for item in fc_items:
        status = item.progress.status if item.progress else "new"
        review_count = item.progress.review_count if item.progress else 0
        if only_review and status == "known":
            continue
        result.append(
            FlashcardStudyItem(
                id=item.id,
                order_index=item.order_index,
                front=item.payload["front"],
                back=item.payload["back"],
                status=status,
                review_count=review_count,
            )
        )
    return result


@router.post("/decks/{deck_id}/flashcards/{item_id}/mark")
def mark_flashcard(
    deck_id: str,
    item_id: str,
    req: FlashcardMarkRequest,
    db: Session = Depends(get_db),
):
    item = (
        db.query(StudyItem)
        .filter(
            StudyItem.id == item_id,
            StudyItem.deck_id == deck_id,
            StudyItem.item_type == "flashcard",
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Карточка табылмады")

    prog = db.query(FlashcardProgress).filter(FlashcardProgress.item_id == item_id).first()
    if not prog:
        prog = FlashcardProgress(
            deck_id=deck_id,
            item_id=item_id,
            status=req.status,
            review_count=1 if req.status == "review" else 0,
        )
        db.add(prog)
    else:
        prog.status = req.status
        if req.status == "review":
            prog.review_count += 1

    db.commit()
    return {"item_id": item_id, "status": prog.status, "review_count": prog.review_count}


@router.post("/decks/{deck_id}/flashcards/reset")
def reset_flashcards(deck_id: str, db: Session = Depends(get_db)):
    db.query(FlashcardProgress).filter(FlashcardProgress.deck_id == deck_id).delete()
    db.commit()
    return {"message": "Карточкалар прогресі қалпына келтірілді"}


# =====================================================================
# 3. ҚОСЫМША МАРШРУТТАР (НӘТИЖЕЛЕР, ФЛЕШКАРТАЛАР, ТЕКСЕРУ, ӘКІМШІ ТЕСТІ)
# =====================================================================

@router.get(
    "/results",
    response_model=list[QuizAttemptOut],
    dependencies=[Depends(require_admin)],
)
def list_all_results(db: Session = Depends(get_db)):
    attempts = (
        db.query(QuizAttempt)
        .order_by(QuizAttempt.started_at.desc())
        .all()
    )
    return [format_attempt_out(a) for a in attempts]


@router.get("/public/quizzes/{share_code}/flashcards")
def get_public_flashcards(share_code: str, db: Session = Depends(get_db)):
    deck = (
        db.query(Deck)
        .filter(
            Deck.share_code == share_code,
            Deck.is_archived.is_(False),
            Deck.is_active.is_(True),
        )
        .first()
    )
    if not deck:
        raise HTTPException(status_code=404, detail="Тест табылмады")

    return [
        {
            "id": item.id,
            "question": item.payload.get("front", ""),
            "answer": item.payload.get("back", ""),
        }
        for item in deck.items
        if item.item_type == "flashcard"
    ]


@router.post("/public/attempts/{attempt_id}/check")
def check_public_answer(
    attempt_id: str,
    req: AnswerCheckRequest,
    x_attempt_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    session = resume_participant_attempt(db, attempt_id, x_attempt_token)
    item = (
        db.query(StudyItem)
        .filter(
            StudyItem.id == req.item_id,
            StudyItem.deck_id == session.deck_id,
            StudyItem.item_type == "mcq",
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Сұрақ табылмады")

    correct_keys = item.payload.get("correct_keys", [])
    is_correct = sorted(req.selected_keys) == sorted(correct_keys)
    return {
        "item_id": item.id,
        "is_correct": is_correct,
        "correct_keys": correct_keys,
    }


@router.get(
    "/decks/{deck_id}/quiz",
    response_model=QuizSessionOut,
    dependencies=[Depends(require_admin)],
)
def start_admin_quiz(deck_id: str, db: Session = Depends(get_db)):
    deck = (
        db.query(Deck)
        .filter(Deck.id == deck_id, Deck.is_archived.is_(False))
        .first()
    )
    if not deck:
        raise HTTPException(status_code=404, detail="Материал табылмады")
    return start_participant_attempt(db, deck.share_code, "Әкімші")


@router.post(
    "/decks/{deck_id}/quiz/submit",
    response_model=QuizAttemptOut,
    dependencies=[Depends(require_admin)],
)
def submit_admin_quiz(
    deck_id: str,
    req: QuizSubmitRequest,
    db: Session = Depends(get_db),
):
    latest_attempt = (
        db.query(QuizAttempt)
        .filter(QuizAttempt.deck_id == deck_id, QuizAttempt.status == "in_progress")
        .order_by(QuizAttempt.started_at.desc())
        .first()
    )
    if not latest_attempt:
        raise HTTPException(status_code=404, detail="Белсенді тест сессиясы табылмады")
    return submit_participant_attempt(
        db, latest_attempt.id, req, latest_attempt.session_token
    )