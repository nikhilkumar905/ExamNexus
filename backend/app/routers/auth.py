from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pymongo.errors import DuplicateKeyError

from ..config import get_settings
from ..db import get_db, serialize
from ..schemas import LoginIn, RegisterIn
from ..security import create_token, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _public_user(user: dict) -> dict:
    u = serialize(user)
    u.pop("password_hash", None)
    return u


@router.post("/register")
async def register(body: RegisterIn):
    code = get_settings().teacher_invite_code
    if body.role == "teacher" and code and body.teacher_code != code:
        raise HTTPException(403, "Invalid teacher invite code")
    user = {
        "name": body.name.strip(),
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "role": body.role,
        "created_at": datetime.now(timezone.utc),
    }
    try:
        res = await get_db().users.insert_one(user)
    except DuplicateKeyError:
        raise HTTPException(409, "Email already registered")
    user["_id"] = res.inserted_id
    return {"token": create_token(str(res.inserted_id), body.role), "user": _public_user(user)}


@router.post("/login")
async def login(body: LoginIn):
    user = await get_db().users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Incorrect email or password")
    return {"token": create_token(str(user["_id"]), user["role"]), "user": _public_user(user)}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return _public_user(user)
