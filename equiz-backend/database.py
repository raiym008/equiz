import secrets
from datetime import datetime, timezone
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
import config

is_sqlite = config.DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

engine = create_engine(
    config.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
)

if is_sqlite:
    @event.listens_for(engine, "connect")
    def _enable_sqlite_fk(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def as_utc(dt: datetime | None) -> datetime | None:
    """SQLite (naive) және PostgreSQL (aware) уақыттарын бірдей UTC форматқа келтіру."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def run_safe_migrations() -> None:
    """
    Бар деректерді ӨШІРМЕЙ, ескі базаға жаңа бағандарды қауіпсіз қосады.
    SQLite және PostgreSQL екеуінде де жұмыс істейді.
    """
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    json_col_type = "TEXT" if is_sqlite else "JSONB"
    bool_true = "1" if is_sqlite else "TRUE"
    bool_false = "0" if is_sqlite else "FALSE"

    with engine.begin() as conn:
        # 1. DECKS кестесін жаңарту
        if "decks" in existing_tables:
            deck_cols = {c["name"] for c in inspector.get_columns("decks")}

            if "share_code" not in deck_cols:
                conn.execute(text("ALTER TABLE decks ADD COLUMN share_code VARCHAR(24)"))
            if "is_active" not in deck_cols:
                conn.execute(
                    text(f"ALTER TABLE decks ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT {bool_true}")
                )
            if "is_archived" not in deck_cols:
                conn.execute(
                    text(f"ALTER TABLE decks ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT {bool_false}")
                )
            if "meta" not in deck_cols:
                conn.execute(
                    text(f"ALTER TABLE decks ADD COLUMN meta {json_col_type} NOT NULL DEFAULT '{{}}'")
                )

            # Ескі тесттерге бірегей share_code толтыру
            rows = conn.execute(
                text("SELECT id FROM decks WHERE share_code IS NULL OR share_code = ''")
            ).fetchall()
            for (deck_id,) in rows:
                conn.execute(
                    text("UPDATE decks SET share_code = :code WHERE id = :id"),
                    {"code": secrets.token_urlsafe(6), "id": deck_id},
                )
            conn.execute(
                text("CREATE UNIQUE INDEX IF NOT EXISTS ix_decks_share_code ON decks (share_code)")
            )

        # 2. QUIZ_ATTEMPTS кестесін жаңарту
        if "quiz_attempts" in existing_tables:
            att_cols = {c["name"] for c in inspector.get_columns("quiz_attempts")}

            if "participant_name" not in att_cols:
                conn.execute(
                    text("ALTER TABLE quiz_attempts ADD COLUMN participant_name VARCHAR(100) NOT NULL DEFAULT 'Қатысушы'")
                )
            if "token_hash" not in att_cols:
                conn.execute(
                    text("ALTER TABLE quiz_attempts ADD COLUMN token_hash VARCHAR(64)")
                )
            if "status" not in att_cols:
                conn.execute(
                    text("ALTER TABLE quiz_attempts ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'completed'")
                )
            if "question_order" not in att_cols:
                conn.execute(
                    text(f"ALTER TABLE quiz_attempts ADD COLUMN question_order {json_col_type} NOT NULL DEFAULT '[]'")
                )
            if "started_at" not in att_cols:
                conn.execute(text("ALTER TABLE quiz_attempts ADD COLUMN started_at TIMESTAMP"))
                conn.execute(
                    text("UPDATE quiz_attempts SET started_at = created_at WHERE started_at IS NULL")
                )
            if "finished_at" not in att_cols:
                conn.execute(text("ALTER TABLE quiz_attempts ADD COLUMN finished_at TIMESTAMP"))
                conn.execute(
                    text("UPDATE quiz_attempts SET finished_at = created_at WHERE status = 'completed' AND finished_at IS NULL")
                )
            if "is_late" not in att_cols:
                conn.execute(
                    text(f"ALTER TABLE quiz_attempts ADD COLUMN is_late BOOLEAN NOT NULL DEFAULT {bool_false}")
                )
            if "meta" not in att_cols:
                conn.execute(
                    text(f"ALTER TABLE quiz_attempts ADD COLUMN meta {json_col_type} NOT NULL DEFAULT '{{}}'")
                )