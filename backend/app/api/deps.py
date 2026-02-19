"""Authentication dependencies for route protection."""
from fastapi import Cookie, HTTPException
from jose import jwt, JWTError
from app.config import settings

COOKIE_NAME = "session"


async def get_current_user(session: str | None = Cookie(default=None)):
    if not session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(session, settings.secret_key, algorithms=[settings.algorithm])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid session")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid session")
