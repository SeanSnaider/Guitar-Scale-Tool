from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from database import Base

class ScaleProgress(Base):
    __tablename__ = "scale_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), nullable=False, index=True)
    root_note = Column(String(10), nullable=False)
    scale_type = Column(String(50), nullable=False)
    position = Column(Integer, default=0)
    learned = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self):
        return f"<ScaleProgress(user_id='{self.user_id}', scale='{self.root_note} {self.scale_type}', position={self.position}, learned={self.learned})>"
