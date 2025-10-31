# Osaka Risk App

防災リスク可視化アプリ。地図表示・地形判定・最寄り避難所検索・リスクカード表示を統合。

## セットアップ
### Backend (FastAPI)
python -m venv venv
venv\Scripts\activate
pip install -r backend/requirements.txt

### Frontend
# 静的HTML/JS（開発中）。任意のローカルサーバで配信 or 直接開く

## .env（例は .env.example を参照）
- DATABASE_URL: 例 `sqlite:///./data/app.db`
- SECRET_KEY: JWT用の秘密鍵
- ALGORITHM: 例 `HS256`
- ACCESS_TOKEN_EXPIRE_MINUTES: 例 `60`
- VITE_API_BASE: 例 `http://127.0.0.1:8000`

## 起動例
# Backend
uvicorn app_API:app --app-dir backend --reload

# Frontend
# front/html/test3.html をブラウザで開く など
