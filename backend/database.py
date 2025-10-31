# database.py
# import os
# from sqlalchemy import create_engine
# from sqlalchemy.orm import sessionmaker, declarative_base
# 
# 
# DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////data/app.db")
# connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
# engine = create_engine(DATABASE_URL, future=True, echo=False, connect_args=connect_args)
# SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
# Base = declarative_base()


# backend/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from pathlib import Path

Base = declarative_base()

# ここにあなたの実在DBパスを入れる（ダブルクォートはPythonの文字列用で、URL内には入れない）
DB_PATH = Path(r"C:\python_first_project\my-python\map-app\project4.1.1\backend\data\app.db")

# Windowsでも安全にURL化（/ 区切りに変換）
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    pool_pre_ping=True,
    future=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

print(f"[DB] URL = {SQLALCHEMY_DATABASE_URL}")
print(f"[DB] File exists? {DB_PATH.exists()} | Path = {DB_PATH}")
