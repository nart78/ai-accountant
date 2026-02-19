"""Authentication endpoints — login, logout, session check."""
from fastapi import APIRouter, Response, HTTPException, Cookie, Request
from pydantic import BaseModel
from jose import jwt, JWTError
import bcrypt
import time
import logging
from collections import defaultdict
from datetime import datetime, timedelta
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

COOKIE_NAME = "session"

# --- Simple in-memory rate limiter for login ---
_login_attempts: dict[str, list[float]] = defaultdict(list)
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_SECONDS = 300  # 5 minutes


def _check_rate_limit(ip: str) -> None:
    """Block login if too many failed attempts from this IP."""
    now = time.time()
    _login_attempts[ip] = [t for t in _login_attempts[ip] if now - t < LOCKOUT_SECONDS]
    if len(_login_attempts[ip]) >= MAX_LOGIN_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Try again in a few minutes.",
        )


def _record_failed_attempt(ip: str) -> None:
    _login_attempts[ip].append(time.time())


def _clear_attempts(ip: str) -> None:
    _login_attempts.pop(ip, None)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


class LoginRequest(BaseModel):
    username: str
    password: str
    remember_me: bool = False


@router.post("/login")
async def login(body: LoginRequest, request: Request, response: Response):
    client_ip = request.headers.get("x-real-ip", request.client.host)
    _check_rate_limit(client_ip)

    username = body.username.strip()
    password = body.password.strip()
    if (
        username != settings.auth_username
        or not verify_password(password, settings.auth_password_hash)
    ):
        _record_failed_attempt(client_ip)
        logger.warning("Failed login attempt from %s", client_ip)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    _clear_attempts(client_ip)

    expire_days = 30 if body.remember_me else 1
    expire = datetime.utcnow() + timedelta(days=expire_days)
    token = jwt.encode(
        {"sub": username, "exp": expire},
        settings.secret_key,
        algorithm=settings.algorithm,
    )

    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=expire_days * 86400 if body.remember_me else None,
        path="/",
    )
    return {"message": "ok", "username": username}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"message": "ok"}


@router.get("/me")
async def me(session: str | None = Cookie(default=None)):
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(session, settings.secret_key, algorithms=[settings.algorithm])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid session")
        return {"username": username}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid session")
