import enum
from sqlalchemy import Enum, Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text, CheckConstraint
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func

Base = declarative_base()

class RoleEnum(enum.Enum):
    EMPLOYEE = "employee"
    MANAGER = "manager"
    ADMIN = "admin"

class GoalStatusEnum(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    RETURNED = "returned"
    APPROVED = "approved"

class CyclePeriodEnum(str, enum.Enum):
    GOAL_SETTING = "GOAL_SETTING"
    Q1 = "Q1"
    Q2 = "Q2"
    Q3 = "Q3"
    Q4 = "Q4"


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
    
    status = Column(Enum(GoalStatusEnum, values_callable=lambda x: [e.value for e in x]), default=GoalStatusEnum.DRAFT) # draft, submitted, returned, approved
    is_locked = Column(Boolean, default=False) # Locked after manager approval
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Optimistic locking/versioning to avoid lost updates
    version_id = Column(Integer, nullable=False, default=1)
    __mapper_args__ = {"version_id_col": version_id}

    # DB-level constraint: weightage must be between 0 and 100
    __table_args__ = (
        CheckConstraint('weightage >= 0 AND weightage <= 100', name='ck_goal_weightage_range'),
    )

    owner = relationship("User", back_populates="goals")
    check_ins = relationship("CheckIn", back_populates="goal")

class CheckIn(Base):
    __tablename__ = "check_ins"
    
    id = Column(Integer, primary_key=True, index=True)
    goal_id = Column(Integer, ForeignKey("goals.id"), nullable=False, index=True)
    quarter = Column(Enum(QuarterEnum), nullable=False, index=True)
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
    period_name = Column(Enum(CyclePeriodEnum), nullable=False) # GOAL_SETTING, Q1, Q2, Q3, Q4
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

from sqlalchemy import event
from database import current_user_id

@event.listens_for(Goal, 'after_insert')
def audit_goal_insert(mapper, connection, target):
    user_id = current_user_id.get() or "system"
    connection.execute(
        AuditLog.__table__.insert().values(
            goal_id=target.id,
            changed_by=user_id,
            change_summary="Goal created"
        )
    )

@event.listens_for(Goal, 'after_update')
def audit_goal_update(mapper, connection, target):
    from sqlalchemy.orm import attributes
    changes = []
    state = attributes.instance_state(target)
    
    attrs_to_track = {
        'thrust_area': 'Thrust area',
        'title': 'Title',
        'description': 'Description',
        'uom': 'UoM',
        'target': 'Target',
        'weightage': 'Weightage',
        'status': 'Status',
        'is_locked': 'Locked state'
    }
    
    for attr, label in attrs_to_track.items():
        history = attributes.get_history(target, attr)
        if history.has_changes():
            old_val = history.deleted[0] if history.deleted else None
            new_val = history.added[0] if history.added else None
            
            if hasattr(old_val, 'value'):
                old_val = old_val.value
            if hasattr(new_val, 'value'):
                new_val = new_val.value
                
            changes.append(f"{label} changed: '{old_val}' -> '{new_val}'")
            
    if changes:
        user_id = current_user_id.get() or "system"
        connection.execute(
            AuditLog.__table__.insert().values(
                goal_id=target.id,
                changed_by=user_id,
                change_summary=" | ".join(changes)
            )
        )