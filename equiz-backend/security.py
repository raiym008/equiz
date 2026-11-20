import time
import hmac
import hashlib
import secrets
from collections import defaultdict, deque
from fastapi import Header, HTTPException, Request
import config


def generate_attempt_token() -> tuple[str, str]:
    """Клиентке берілетін ашық токен мен базада сақталатын SHA-256 хэшін қайтарады."""
    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_token(raw_token)
    return raw_token, token_hash


def hash_token(raw_token: str) -> str:
    salted = f"{config.SECRET_KEY}:{raw_token}".encode("utf-8")
    return hashlib.sha256(salted).hexdigest()


def verify_attempt_token(raw_token: str | None, expected_hash: str | None) -> bool:
    if not expected_hash:
        return True
    if not raw_token:
        return False
    return hmac.compare_digest(hash_token(raw_token), expected_hash)


def require_admin(x_admin_key: str | None = Header(default=None)) -> None:
    """
    Әкімші панеліне арналған қорғаныс.
    Қатысушы маршруттарына БҰЛ ҚОЙЫЛМАЙДЫ (олар тек атымен кіреді).
    """
    if not config.ADMIN_API_KEY:
        return
    if not x_admin_key or not hmac.compare_digest(x_admin_key, config.ADMIN_API_KEY):
        raise HTTPException(status_code=401, detail="Әкімші рұқсаты жоқ")


class SimpleRateLimiter:
    """Бот-спамнан қорғауға арналған жеңіл сұраныс шектегіші."""

    def __init__(self, max_requests: int = 20, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def __call__(self, request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        now = time.monotonic()
        q = self._hits[client_ip]

        while q and now - q[0] > self.window_seconds:
            q.popleft()

        if len(q) >= self.max_requests:
            raise HTTPException(
                status_code=429,
                detail="Сұраныстар тым көп. Бір минуттан кейін қайталап көріңіз.",
            )
        q.append(now)


start_quiz_limiter = SimpleRateLimiter(max_requests=25, window_seconds=60)