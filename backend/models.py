import enum
from sqlalchemy import Enum, Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func

Base = declarative_base()

class RoleEnum(enum.Enum):
    EMPLOYEE = "employee"
    MANAGER = "manager"
    ADMIN = "admin"

class UoMEnum(enum.Enum):
    NUMERIC_MIN = "min"
    NUMERIC_MAX = "max"
    TIMELINE = "timeline"
    ZERO = "zero"
    
class StatusEnum(enum.Enum):
    NOT_STARTED = "not_started"
    ON_TRACK = "on_track"
    COMPLETED = "completed"
    
class QuarterEnum(enum.Enum):
    Q1 = "Q1"
    Q2 = "Q2"
    Q3 = "Q3"
    Q4 = "Q4"
    
#Tables

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, index=True) # Will store Azure AD Object ID
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    role = Column(Enum(RoleEnum), default=RoleEnum.EMPLOYEE, nullable=False)
    manager_id = Column(String, ForeignKey("users.id"), nullable=True) # Self-referencing hierarchy
    
    # Relationships
    manager = relationship("User", remote_side=[id], backref="team_members")
    goals = relationship("Goal", back_populates="owner")

class Goal(Base):
    __tablename__ = "goals"
    
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    thrust_area = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    uom = Column(Enum(UoMEnum), nullable=False)
    target = Column(Float, nullable=False) # Store dates as timestamps if Timeline
    weightage = Column(Float, nullable=False) # Must be >= 10, total per user = 100
    
    is_locked = Column(Boolean, default=False) # Locked after manager approval
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", back_populates="goals")
    check_ins = relationship("CheckIn", back_populates="goal")

class CheckIn(Base):
    __tablename__ = "check_ins"
    
    id = Column(Integer, primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=False)
    quarter = Column(Enum(QuarterEnum), nullable=False)
    actual_achievement = Column(Float, nullable=False)
    status = Column(Enum(StatusEnum), default=StatusEnum.NOT_STARTED)
    manager_comment = Column(Text, nullable=True)
    
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    
    goal = relationship("Goal", back_populates="check_ins")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=False)
    changed_by = Column(String, ForeignKey("users.id"), nullable=False)
    change_summary = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())