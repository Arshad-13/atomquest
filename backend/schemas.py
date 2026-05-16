from pydantic import BaseModel, Field
from typing import Optional, List
from models import UoMEnum, StatusEnum, QuarterEnum

class GoalBase(BaseModel):
    thrust_area: str
    title:str
    description: Optional[str] = None
    uom: UoMEnum
    target: float
    weightage: float = Field(..., ge=10, le=100, description="Min. 10, Max. 100")
    
class GoalCreate(GoalBase):
    owner_id: str
    
class GoalResponse(GoalBase):
    id: int
    owner_id: str
    is_locked: bool
    
    class Config:
        from_attributes = True

class UserBasic(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True

class TeamGoalResponse(GoalResponse):
    owner: UserBasic  

class GoalUpdate(BaseModel):
    target: Optional[float] = None
    weightage: Optional[float] = None
    is_locked: Optional[bool] = None
    manager_id: str 