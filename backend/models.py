import enum
from sqlalchemy import Enum, Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func
import datetime

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
    
    id = Column(String, primary_key=True, index=True) # Azure AD Object ID or internal ID
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    role = Column(Enum(RoleEnum), default=RoleEnum.EMPLOYEE, nullable=False)
    hashed_password = Column(String, nullable=True)  # NULL for SSO users; set for demo/password users
    manager_id = Column(String, ForeignKey("users.id"), nullable=True)
    
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
    
    status = Column(String, default="draft") # draft, submitted, returned, approved
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
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=True)
    changed_by = Column(String, ForeignKey("users.id"), nullable=False)
    change_summary = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

class CycleWindow(Base):
    __tablename__ = "cycle_windows"
    
    id = Column(Integer, primary_key=True, index=True)
    period_name = Column(String, nullable=False) # GOAL_SETTING, Q1, Q2, Q3, Q4
    open_date = Column(DateTime(timezone=True), nullable=False)
    close_date = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, default=False)

class SharedGoalLink(Base):
    __tablename__ = "shared_goal_links"
    
    id = Column(Integer, primary_key=True, index=True)
    base_goal_id = Column(Integer, ForeignKey("goals.id"), nullable=False)
    primary_owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    recipient_id = Column(String, ForeignKey("users.id"), nullable=False)
    custom_weightage = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ApprovalRequest(Base):
    __tablename__ = "approval_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=False)
    submitted_by = Column(String, ForeignKey("users.id"), nullable=True)
    reviewed_by = Column(String, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False) # SUBMITTED, APPROVED, RETURNED
    comment = Column(Text, nullable=True)
    actioned_at = Column(DateTime(timezone=True), server_default=func.now())
    
# Assuming you have an Enum setup, or just use strings for SQLite/Postgres simplicity
class EscalationRule(Base):
    __tablename__ = "escalation_rules"
    id = Column(Integer, primary_key=True, index=True)
    trigger_event = Column(String, unique=True) # e.g., "GOAL_NOT_SUBMITTED"
    days_threshold = Column(Integer, default=7)
    is_active = Column(Boolean, default=True)

class EscalationLog(Base):
    __tablename__ = "escalation_logs"
    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(Integer, ForeignKey("escalation_rules.id"))
    employee_id = Column(String, ForeignKey("users.id"))
    manager_id = Column(String, ForeignKey("users.id"))
    triggered_at = Column(DateTime(timezone=True), server_default=func.now())
    is_resolved = Column(Boolean, default=False)