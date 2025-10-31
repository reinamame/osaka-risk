# import_csv_to_db.py


import pandas as pd
from sqlalchemy import create_engine
from models import TerrainRisk, Base
from database import engine, SessionLocal

Base.metadata.drop_all(bind=engine)   # 既存のテーブル削除
Base.metadata.create_all(bind=engine) # 再作成
db = SessionLocal()

# ======== CSV 読み込み ========
csv_path = "/data/inosaka_overall_risk.csv"
df = pd.read_csv(csv_path)



# ======== データ登録 ========
for _, row in df.iterrows():
    try:
        # 緯度経度が欠損していないかチェック
        if pd.isna(row["lat"]) or pd.isna(row["lon"]):
            continue

        # CSVの値をDBフィールドに対応づける
        if db.query(TerrainRisk).filter_by(lat=row["lat"], lon=row["lon"]).first():
            continue

        risk = TerrainRisk(
            lat=float(row['lat']),
            lon=float(row['lon']),
            flood_risk = int(row.get("flood_score", 0) or 0),
            landslide_risk = int(row.get("landslide_score", 0) or 0),
            tsunami_risk = int(row.get("tsunami_score", 0) or 0),
            overall_risk = int(row.get("overall_risk", 0) or 0),
            risk_description = str(row.get("リスク一覧", "")) if pd.notna(row.get("リスク一覧")) else "",
            elev_score = float(row.get("elev_score", 0) or 0),
            slope_score = float(row.get("slope_score", 0) or 0),
            river_score = float(row.get("river_score", 0) or 0),
        )
        db.add(risk)
    except Exception as e:
        print("⚠️ エラー行:", row)
        print("原因:", e)

db.commit()
db.close()

print("✅ CSVデータをDBに登録しました。")





