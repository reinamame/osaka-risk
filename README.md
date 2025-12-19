# Osaka Risk App
大阪の災害リスクを地図上で直感的に把握できるWebアプリ。GSI災害タイルの重ね合わせ、地点リスクや最寄り避難所の表示に対応。

## Demo
- https://osaka-georisk.com
- ローカル起動手順は下記参照

## Why
ハザード情報はあるが“なぜ危険か/どの程度か”が分かりにくい課題に対し、地形を軸に意思決定できる形で提示する。

## Screenshots
<details>
  <summary>スクリーンショットを見る（クリックで展開）</summary>

  <img width="2852" height="1668" alt="map" src="https://github.com/user-attachments/assets/320530bc-0f9e-4bb6-8dda-41555df90bc0" />
  <img width="2056" height="1576" alt="card" src="https://github.com/user-attachments/assets/9248fa11-9237-4577-9993-8d0728194afc" />

</details>

## Features
- 現在地 / 任意地点のリスク表示（スコア+ 説明）
- 国土地理院（GSI）災害タイル（土地条件図 / 洪水 / 津波 / 土石流）の重ね合わせ・切替
- 最寄り避難所検索（国土数値情報の避難所データを利用）
- お気に入り（保存 / 一覧 / 削除）※ログイン後

## scoring/explanation
0–100は確率ではなく比較用の相対スコア。洪水/津波/土砂等の区域データ＋標高/傾斜/河川距離をルールベースで合算し、根拠テキストも返す。

## Data Sources
国土地理院（GSI）災害タイル（洪水・津波・土砂災害等）
国土数値情報：避難所データ、地形データ

## Disclaimer
本アプリは意思決定支援を目的としたもので、最終的な判断は自治体等の公的情報をご確認ください。


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


