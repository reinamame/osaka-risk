# Osaka Risk App
大阪の災害リスクを地図上で直感的に把握できるWebアプリ。GSI災害タイルの重ね合わせ、地点リスク表示、最寄り避難所検索に対応。

## Demo
- https://osaka-georisk.com
- ローカル起動手順は下記参照

## Features
- 現在地 / 任意地点のリスク表示（危険度% + 説明）
- 国土地理院（GSI）災害タイル（土地条件図 / 洪水 / 津波 / 土石流）の重ね合わせ・切替
- 最寄り避難所検索（国土数値情報の避難所データを利用）
- お気に入り（保存 / 一覧 / 削除）※ログイン後

## Tech Stack
- Frontend: HTML / JavaScript / Leaflet
- GIS: Web map tiles（GSI / OpenStreetMap）
- Backend: Python / FastAPI / Uvicorn / SQLite / SQLAlchemy
- Auth: JWT（PyJWT）/ passlib（password hash）
- Infra: AWS Lightsail / Nginx / systemd

## Setup
### Backend
```bash
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r backend/requirements.txt
```


## .env
`backend/.env` を作成してください（`.env.example` をコピー）。

- DATABASE_URL: `sqlite:///./data/app.db`
- SECRET_KEY: JWT用の秘密鍵
- ALGORITHM: `HS256`
- ACCESS_TOKEN_EXPIRE_MINUTES: `60`
- VITE_API_BASE: `http://127.0.0.1:8000`

## Run

### Backend
```bash
uvicorn app_API:app --app-dir backend --reload
```

### Frontend（静的HTML/JS）
ローカルサーバで配信することを推奨します。

```bash
python -m http.server 5500 --directory front/html
# → http://localhost:5500/test3.html
```

## Notes
フロントとAPIが別オリジンになる構成のため、環境によってはCORS設定が必要です。


