from sqlalchemy import Column, String
from db.database import Base


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String(100), primary_key=True)
    value = Column(String, nullable=False)
