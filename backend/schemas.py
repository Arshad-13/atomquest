from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from models import UoMEnum, StatusEnum, QuarterEnum, RoleEnum

class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: RoleEnum
    manager_id: Optional[str] = None

class ResetPasswordRequest(BaseModel):
    password: str

class GoalBase(BaseModel):
    thrust_area: str
    title:str
    description: Optional[str] = None
    uom: UoMEnum
    target: float
    weightage: float = Field(..., ge=0, description="Weightage percentage")
    
class GoalCreate(GoalBase):
    owner_id: str
    weightage: float = Field(..., ge=10, le=100, description="Min. 10%, Max. 100%")
    
class GoalResponse(GoalBase):
    id: int
    owner_id: str
    status: Optional[str] = "draft"
    is_locked: bool
    return_comment: Optional[str] = None
    
    class Config:
        from_attributes = True

class ApprovalRequestResponse(BaseModel):
    id: int
    goal_id: int
    submitted_by: str
    reviewed_by: Optional[str] = None
    action: str
    comment: Optional[str] = None
    actioned_at: datetime
    
    class Config:
        from_attributes = True

class ReturnRequest(BaseModel):
    comment: str

class UserBasic(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True

class UserBasicWithWeightage(BaseModel):
    id: str
    name: str
    role: str
    total_weightage: float
    is_locked: bool

    class Config:
        from_attributes = True

class UserDirectoryResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    total_weightage: float
    is_locked: bool
    manager_id: Optional[str] = None
    manager_name: Optional[str] = None

    class Config:
        from_attributes = True

class TeamGoalResponse(GoalResponse):
    owner: UserBasic  

class GoalUpdate(BaseModel):
    thrust_area: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    uom: Optional[UoMEnum] = None
    target: Optional[float] = None
    weightage: Optional[float] = None
    is_locked: Optional[bool] = None
    manager_id: Optional[str] = None
    
class CheckInBase(BaseModel):
    quarter: QuarterEnum
    actual_achievement: float
    status: StatusEnum

class CheckInCreate(CheckInBase):
    goal_id: int

class CheckInReview(BaseModel):
    manager_comment: str

class CheckInResponse(CheckInBase):
    id: int
    goal_id: int
    manager_comment: Optional[str] = None
    progress_score: float  # We will calculate this on the fly before sending to frontend

    class Config:
        from_attributes = True
        
class AuditLogResponse(BaseModel):
    id: int
    goal_id: int
    changed_by: str
    change_summary: str
    timestamp: datetime

    class Config:
        from_attributes = True

class SharedGoalCreate(BaseModel):
    # Fan-out fields (used by push_shared_goal)
    title: Optional[str] = None
    description: Optional[str] = None
    thrust_area: Optional[str] = None
    uom: Optional[str] = None
    target: Optional[float] = None
    weightage: Optional[float] = None
    # Link fields (used when base_goal_id already exists)
    base_goal_id: Optional[int] = None
    recipient_ids: List[str]
    primary_owner_id: str

class SharedGoalLinkResponse(BaseModel):
    id: int
    base_goal_id: int
    primary_owner_id: str
    recipient_id: str
    custom_weightage: Optional[float] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class SharedGoalWeightageUpdate(BaseModel):
    custom_weightage: float = Field(..., ge=10, le=100)

class SharedGoalAchievementUpdate(BaseModel):
    quarter: QuarterEnum
    actual_achievement: float

class CycleWindowBase(BaseModel):
    period_name: str
    open_date: datetime
    close_date: datetime

class CycleWindowCreate(CycleWindowBase):
    pass
    
class CycleWindowResponse(CycleWindowBase):
    id: int
    is_active: bool
    
    class Config:
        from_attributes = True
class UnlockRequest(BaseModel):
    reason: str

class CompletionRow(BaseModel):
    id: str
    name: str
    department: str
    goals_submitted: int
    goals_approved: int
    check_in_status: str 
    last_activity: Optional[datetime] = None

class AchievementReportRow(BaseModel):
    employee_name: str
    goal_title: str
    quarter: str
    planned_target: float
    actual_achievement: float
    progress_score: float

class GoalApproveRequest(BaseModel):
    target: float
    weightage: float

class GoalReturnRequest(BaseModel):
    comment: str
    target: Optional[float] = None
    weightage: Optional[float] = None

class TeamCheckInResponse(BaseModel):
    id: int  # Check-in ID
    quarter: str
    actual_achievement: float
    status: str
    manager_comment: Optional[str] = None
    progress_score: float
    goal_id: int
    goal_title: str
    goal_thrust_area: str
    goal_target: float
    goal_uom: str
    employee_id: str
    employee_name: str

    class Config:
        from_attributes = True
        
# SharedGoalCreate is defined above (line ~87) — no duplicate needed.
    
class AdminCompletionRow(BaseModel):
    user_id: str
    name: str
    department: str
    goals_submitted: int
    goals_approved: int
    check_in_completed: bool
    status_category: str  # "complete", "in_progress", "not_started"

    class Config:
        from_attributes = True
        
class AdminUnlockRequest(BaseModel):
    reason: str

class AdminAuditLogResponse(BaseModel):
    id: int
    timestamp: datetime
    goal_id: Optional[int] = None
    goal_title: Optional[str] = None
    employee_name: Optional[str] = None
    changed_by_name: str
    change_summary: str

    class Config:
        from_attributes = True

class QoQTrendPoint(BaseModel):
    quarter: str
    Engineering: float
    Management: float

class GoalDistributionPoint(BaseModel):
    name: str
    value: int

class UoMBreakdownPoint(BaseModel):
    name: str
    count: int

class ManagerEffectivenessPoint(BaseModel):
    name: str
    completionRate: float

class AdminAnalyticsResponse(BaseModel):
    qoq_trends: List[QoQTrendPoint]
    goal_distribution: List[GoalDistributionPoint]
    uom_breakdown: List[UoMBreakdownPoint]
    manager_effectiveness: List[ManagerEffectivenessPoint]

class EscalationRuleUpdate(BaseModel):
    days_threshold: int
    is_active: bool

class EscalationLogResponse(BaseModel):
    id: int
    trigger_event: str
    employee_name: str
    manager_name: str
    triggered_at: datetime
    is_resolved: bool