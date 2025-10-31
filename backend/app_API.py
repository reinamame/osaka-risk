# app_API.py（順序修正版）
import os
from fastapi import FastAPI, Query, Depends, Body, Request, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import SessionLocal, engine
from models import Base, TerrainRisk, Favorite, User, Shelter

# 認証系
from passlib.context import CryptContext
from passlib.hash import pbkdf2_sha256
import jwt  # PyJWT
from datetime import datetime, timedelta

# ユーティリティ
from math import radians, cos, sin, asin, sqrt
import pandas as pd
from pyproj import Transformer
from shapely.geometry import Point


# app_API.py 冒頭の import 群のすぐ下あたりに
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent / ".env")  # backend/.env を読む

print("DEBUG SECRET_KEY set? ->", bool(os.getenv("SECRET_KEY")))
print("DEBUG CORS_ALLOW_ORIGINS raw ->", os.getenv("CORS_ALLOW_ORIGINS"))

# ===== Env から読む =====
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is not set (check .env)")

cors_raw = os.getenv("CORS_ALLOW_ORIGINS", "")
ALLOW_ORIGINS = []
for part in cors_raw.split(","):
    origin = part.strip().strip("'\"").rstrip("/")  # 空白・引用符・末尾スラ除去
    if origin:
        ALLOW_ORIGINS.append(origin)

if not ALLOW_ORIGINS:
    ALLOW_ORIGINS = [
        "http://127.0.0.1:5500", "http://localhost:5500",
        "http://127.0.0.1:5501", "http://localhost:5501",
    ]


ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 14  # 2週間

# -----------------------------------------------------------------------------
# FastAPI アプリ & CORS
# -----------------------------------------------------------------------------
app = FastAPI(
    title="Osaka Disaster Risk API",
    version="0.1.0",
    docs_url="/api/docs",            # ← ここを追加
    openapi_url="/api/openapi.json", # ← ここを追加
    # あるいは root_path="/api" でもOK（どちらかでよい）
    # root_path="/api",
    servers=[{"url": "/api"}],       # ← 任意：表示上のベースURL
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

# -----------------------------------------------------------------------------
# スキーマ整備（※1回だけ定義・呼び出し）
# -----------------------------------------------------------------------------
def ensure_sqlite_schema(engine):
    with engine.begin() as conn:
        # users テーブル新規 or 既存拡張
        conn.exec_driver_sql("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            device_id TEXT UNIQUE,
            email TEXT UNIQUE,
            password_hash TEXT,
            nickname TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            last_seen  TEXT DEFAULT (datetime('now'))
        )""")

        cols = conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()
        ucols = {c[1] for c in cols}
        if "email" not in ucols:
            conn.exec_driver_sql("ALTER TABLE users ADD COLUMN email TEXT")
        if "password_hash" not in ucols:
            conn.exec_driver_sql("ALTER TABLE users ADD COLUMN password_hash TEXT")

        cols = conn.exec_driver_sql("PRAGMA table_info(favorites)").fetchall()
        fcols = {c[1] for c in cols}
        if "device_id" not in fcols:
            conn.exec_driver_sql("ALTER TABLE favorites ADD COLUMN device_id TEXT")
        if "user_id" not in fcols:
            conn.exec_driver_sql("ALTER TABLE favorites ADD COLUMN user_id INTEGER")
        if "simple_warnings" not in fcols:
            conn.exec_driver_sql("ALTER TABLE favorites ADD COLUMN simple_warnings TEXT")
        if "created_at" not in fcols:
            conn.exec_driver_sql("ALTER TABLE favorites ADD COLUMN created_at TEXT")
        if "updated_at" not in fcols:
            conn.exec_driver_sql("ALTER TABLE favorites ADD COLUMN updated_at TEXT")

        conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_users_email ON users (email)")
        conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_favorites_user_id ON favorites (user_id)")
        conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_favorites_device_id ON favorites (device_id)")

ensure_sqlite_schema(engine)

# -----------------------------------------------------------------------------
# 投影変換 / Geo ユーティリティ
# -----------------------------------------------------------------------------
transformer = Transformer.from_crs("EPSG:4326", "EPSG:6674", always_xy=True)

def latlon_to_6674(lat, lon):
    x, y = transformer.transform(lon, lat)
    return Point(x, y)

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
    return 2 * R * asin(sqrt(a))

# -----------------------------------------------------------------------------
# DB セッション（← 先に定義しておく：Depends で参照されるため）
# -----------------------------------------------------------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# -----------------------------------------------------------------------------
# 認証セットアップ（get_db を参照する関数はここから下に）
# -----------------------------------------------------------------------------


pwd_context = CryptContext(
    schemes=["pbkdf2_sha256", "bcrypt_sha256", "bcrypt"],   # ← bcrypt_sha256 を使い、旧bcryptも検証OK
    deprecated="auto",
    bcrypt__truncate_error=False           # ← 72バイト超エラーを無効化
)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_password_hash(p: str) -> str:
    # ← ここを“必ず” bcrypt_sha256 でハッシュ
    return pbkdf2_sha256.hash(p)  

def verify_password(plain: str, hashed: str) -> bool:
    # 既存bcrypt等も自動判別して検証
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    cred_exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if not sub:
            raise cred_exc
        user = db.query(User).get(int(sub))
        if not user:
            raise cred_exc
        return user
    except Exception:
        raise cred_exc

# Bearer トークンが無い時は None を返す依存関数
def get_optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    auth = request.headers.get("authorization")
    if not auth:
        return None
    scheme, _, token = auth.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        uid = int(payload.get("sub"))
        return db.query(User).get(uid)
    except Exception:
        return None

# -----------------------------------------------------------------------------
# 近傍検索 / 説明生成
# -----------------------------------------------------------------------------
MAX_DISTANCE_M = 400

def nearest_point(lat: float, lon: float, db: Session):
    all_data = db.query(TerrainRisk).all()
    pt = latlon_to_6674(lat, lon)
    min_dist = float("inf")
    nearest = None
    for row in all_data:
        row_point = Point(row.lon, row.lat)
        dist = row_point.distance(pt)
        if dist < min_dist:
            min_dist = dist
            nearest = row
    return nearest, min_dist

def generate_risk_explanation(elev_score, slope_score, river_score, risk_description):
    if pd.isna(risk_description) or risk_description is None:
        risk_description = ""
    else:
        risk_description = str(risk_description)

    explanation = ""
    if elev_score and slope_score:
        if elev_score >= 25 and slope_score <= 10:
            explanation += " 標高が低く、海や河川に近い地域で洪水リスクが高い傾向にあります。"
        elif elev_score >= 18 and slope_score <= 15:
            explanation += " 標高がやや低く、浸水被害の可能性があります。"
        elif slope_score >= 20:
            explanation += " 傾斜が急で、土砂災害の危険があります。"
        elif slope_score >= 12:
            explanation += " やや傾斜地にあり、雨量が多いときは土砂崩れに注意が必要です。"
        elif elev_score <= 13 and slope_score <= 10:
            explanation += " 高台に位置し、比較的安定した地形です。災害リスクは低めです。"
        else:
            explanation += " 特定の災害リスクは中程度です。"
    else:
        explanation += " 地形スコア情報が未登録のため、簡易的な評価です。"

    if "洪水" in risk_description:
        explanation += " 洪水ハザードマップ上では浸水可能性が示されています。"
    if "土砂" in risk_description or "崩壊" in risk_description:
        explanation += " 土砂崩れ・斜面崩壊の危険も考えられます。"
    if "津波" in risk_description:
        explanation += " 津波の可能性があり、注意が必要です。"

    return explanation

# -----------------------------------------------------------------------------
# ユーザー登録（device_id）
# -----------------------------------------------------------------------------
@app.post("/users/register")
def register_user(data: dict = Body(...), db: Session = Depends(get_db)):
    device_id = data.get("device_id")
    nickname  = data.get("nickname")
    if not device_id:
        return {"status": "error", "detail": "device_id is required"}

    user = db.query(User).filter(User.device_id == device_id).first()
    if not user:
        user = User(device_id=device_id, nickname=nickname)
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if nickname:
            user.nickname = nickname
            db.commit()
            db.refresh(user)
    return {"status": "ok", "id": user.id, "device_id": user.device_id, "nickname": user.nickname}

# -----------------------------------------------------------------------------
# 認証エンドポイント
# -----------------------------------------------------------------------------
@app.post("/auth/register")
def auth_register(data: dict = Body(...), db: Session = Depends(get_db)):
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    nickname = data.get("nickname")
    device_id = data.get("device_id")

    if not email or not password:
        raise HTTPException(400, "email / password は必須です")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(409, "既に登録されています")

    user = User(email=email, password_hash=get_password_hash(password), nickname=nickname, device_id=device_id)
    db.add(user); db.commit(); db.refresh(user)

    # device_id があれば favorites を引き取り
    if device_id:
        db.query(Favorite).filter(Favorite.device_id == device_id, Favorite.user_id == None)\
            .update({Favorite.user_id: user.id})
        db.commit()

    token = create_access_token({"sub": str(user.id)})
    return {"status": "ok", "access_token": token, "token_type": "bearer"}

@app.post("/auth/login")
def auth_login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    email = form.username.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(form.password, user.password_hash or ""):
        raise HTTPException(401, "メールまたはパスワードが違います")

    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}

@app.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "nickname": current_user.nickname,
        "device_id": current_user.device_id
    }

@app.post("/auth/claim_device")
def claim_device(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    device_id = request.headers.get("x-device-id")
    if not device_id:
        raise HTTPException(400, "X-Device-ID が必要です")
    db.query(Favorite).filter(Favorite.device_id == device_id, Favorite.user_id == None)\
        .update({Favorite.user_id: current_user.id})
    db.commit()
    return {"status": "ok"}

# -----------------------------------------------------------------------------
# リスク API
# -----------------------------------------------------------------------------
@app.get("/risk")
def get_risk(lat: float = Query(...), lon: float = Query(...), db: Session = Depends(get_db)):
    nearest, min_dist = nearest_point(lat, lon, db)
    if not nearest or min_dist > MAX_DISTANCE_M:
        return {"status": "no_match", "overall_risk": None, "risk_description": "", "explanation": "一致する地点が見つかりませんでした。"}

    explanation = generate_risk_explanation(
        elev_score=nearest.elev_score or 0,
        slope_score=nearest.slope_score or 0,
        river_score=nearest.river_score or 0,
        risk_description=nearest.risk_description or ""
    )
    return {
        "status": "ok",
        "overall_risk": nearest.overall_risk,
        "risk_description": nearest.risk_description,
        "explanation": explanation
    }

# -----------------------------------------------------------------------------
# お気に入り API（ログイン優先 / 未ログインは device_id）
# -----------------------------------------------------------------------------
@app.post("/favorites")
def add_favorite(
    request: Request,
    data: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user)
):
    device_id = request.headers.get("x-device-id")
    fav = Favorite(
        lat=data["lat"], lon=data["lon"], title=data["title"],
        terrain_type=data.get("terrain_type"),
        risk_score=data.get("risk_score"),
        risk_description=data.get("risk_description"),
        explanation=data.get("explanation"),
        simple_warnings=data.get("simple_warnings"),
        nearest_shelter=data.get("nearest_shelter"),
        device_id=device_id,
        user_id=current_user.id if current_user else None,
    )
    db.add(fav); db.commit(); db.refresh(fav)
    return {"status": "ok", "id": fav.id}

@app.get("/favorites")
def list_favorites(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user)
):
    q = db.query(Favorite)
    if current_user:
        q = q.filter(Favorite.user_id == current_user.id)
    else:
        device_id = request.headers.get("x-device-id")
        if device_id:
            q = q.filter(Favorite.device_id == device_id)
        else:
            return []
    return q.order_by(Favorite.created_at.desc()).all()

@app.delete("/favorites/{fav_id}")
def delete_favorite(
    fav_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user)
):
    q = db.query(Favorite).filter(Favorite.id == fav_id)
    if current_user:
        q = q.filter(Favorite.user_id == current_user.id)
    else:
        device_id = request.headers.get("x-device-id")
        q = q.filter(Favorite.device_id == device_id)
    fav = q.first()
    if not fav:
        return {"status": "not_found"}
    db.delete(fav); db.commit()
    return {"status": "deleted"}

# -----------------------------------------------------------------------------
# 避難所 API
# -----------------------------------------------------------------------------
@app.get("/shelters/nearest")
def shelters_nearest(lat: float, lon: float, limit: int = 3, db: Session = Depends(get_db)):
    rows = db.query(Shelter).all()
    if not rows:
        return []
    scored = []
    for s in rows:
        d = haversine_km(lat, lon, s.lat, s.lon)
        scored.append({
            "id": s.id, "name": s.name, "ward": s.ward, "address": s.address,
            "type": s.type, "capacity": s.capacity, "lat": s.lat, "lon": s.lon,
            "phone": s.phone, "opening_condition": s.opening_condition,
            "distance_km": d
        })
    scored.sort(key=lambda x: x["distance_km"])
    return scored[:max(1, min(limit, 20))]

# -----------------------------------------------------------------------------
# 共通エラーハンドラ
# -----------------------------------------------------------------------------
from fastapi.responses import JSONResponse
import traceback

@app.exception_handler(Exception)
async def all_exception_handler(request: Request, exc: Exception):
    print("\n=== Internal Server Error Traceback ===")
    traceback.print_exc()
    print("========================================\n")
    return JSONResponse(status_code=500, content={"status": "error", "detail": str(exc)})


@app.get("/_debug/auth_scheme")
def _debug_auth_scheme():
    return {"schemes": pwd_context.schemes()}

@app.get("/_debug/cors")
def _debug_cors():
    return {"allow_origins": ALLOW_ORIGINS}

@app.get("/health")
def health():
    return {"ok": True}

