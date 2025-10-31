# import_shelters_from_geojson.py
import json
from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import Base, Shelter

def main(path: str):
    # テーブルがなければ作成
    Base.metadata.create_all(bind=engine)

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    feats = data.get("features", [])

    inserted = 0
    skipped = 0
    with SessionLocal() as db:
        for ft in feats:
            props = (ft.get("properties") or {})
            geom  = (ft.get("geometry") or {})
            coords = (geom.get("coordinates") or [])
            if len(coords) < 2:
                continue

            lon, lat = coords[0], coords[1]

            # GSI のプロパティ名に合わせたマッピング
            name     = props.get("P20_002") or props.get("名称") or "名称不明"
            ward     = props.get("P20_001") or props.get("区") or ""
            address  = props.get("P20_003") or props.get("住所") or ""
            typ      = props.get("P20_004")    or props.get("種別") or ""
            capacity = props.get("P20_005") or props.get("収容人数")
            try:
                capacity = int(capacity) if capacity not in (None, "", "NaN") else None
            except:
                capacity = None
            phone    = props.get("電話") or props.get("phone") or ""
            cond     = props.get("開設条件") or props.get("opening_condition") or ""

            # すでに同じ (name, lat, lon) があればスキップ
            exists = db.query(Shelter).filter(
                Shelter.name == name,
                Shelter.lat  == lat,
                Shelter.lon  == lon
            ).first()
            if exists:
                skipped += 1
                continue

            db.add(Shelter(
                name=name, ward=ward, address=address, type=typ, capacity=capacity,
                lat=lat, lon=lon, phone=phone, opening_condition=cond, source="geojson"
            ))
            inserted += 1

        db.commit()

    print(f"Inserted: {inserted}, Skipped (duplicate): {skipped}")

if __name__ == "__main__":
    import sys
    # 既定パスはあなたの現在の GeoJSON 位置
    path = sys.argv[1] if len(sys.argv) > 1 else "./data/shelter_osaka.geojson"
    main(path)
