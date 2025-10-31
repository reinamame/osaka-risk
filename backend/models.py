# models.py
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey, Boolean, func
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True, nullable=True)       # 追加
    password_hash = Column(String, nullable=True) 
    nickname = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    last_seen  = Column(DateTime, server_default=func.now(), onupdate=func.now())

    favorites = relationship("Favorite", back_populates="user", cascade="all, delete-orphan")


# risk
class TerrainRisk(Base):
    __tablename__ = "terrain_risk"

    id = Column(Integer, primary_key=True, index=True)
    lat = Column(Float)
    lon = Column(Float)
    flood_risk = Column(Integer, default=0)
    landslide_risk = Column(Integer, default=0)
    tsunami_risk = Column(Integer, default=0)
    overall_risk = Column(Integer, default=0)
    risk_description = Column(String) 

    # ← 以下を追加
    elev_score = Column(Float, nullable=True)
    slope_score = Column(Float, nullable=True)
    river_score = Column(Float, nullable=True)


# Favorite
class Favorite(Base):
    __tablename__ = "favorites"

    id = Column(Integer, primary_key=True, index=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    title = Column(String, nullable=False)
    terrain_type = Column(String, nullable=True)
    risk_score = Column(Integer, nullable=True)
    risk_description = Column(String, nullable=True)
    explanation = Column(String, nullable=True)
    nearest_shelter = Column(String, nullable=True)
    simple_warnings = Column(Text, nullable=True)


    # ★ 追加: ユーザーひも付け
    device_id = Column(String, index=True, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="favorites")


class Shelter(Base):
    __tablename__ = "shelters"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, index=True)      # 施設名
    ward = Column(String, index=True)                      # 区
    address = Column(String)
    type = Column(String)                                  # 指定避難所/一時避難所など
    capacity = Column(Integer)                             # 収容人数（任意）
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    phone = Column(String)
    opening_condition = Column(String)                     # 開設条件
    source = Column(String)                                # データ出典
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
