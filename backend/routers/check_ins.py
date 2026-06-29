from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone

from database import get_db
import models
import schemas
from auth.dependencies import get_current_user, require_role
from routers.goals import calculate_progress_score

router = APIRouter(tags=["check_ins"])

def check_window_open(period: models.CyclePeriodEnum, db: Session):
    now = datetime.now(timezone.utc)
    active_window = db.query(models.CycleWindow).filter(models.CycleWindow.is_active == True).first()
    if not active_window:
        raise HTTPException(status_code=423, detail="No active cycle window.")
    
    period_val = period.value if hasattr(period, 'value') else period
    window_val = active_window.period_name.value if hasattr(active_window.period_name, 'value') else active_window.period_name
    if window_val != period_val:
        raise HTTPException(status_code=423, detail=f"Active window is for {window_val}, not {period_val}.")
        
    open_date = active_window.open_date.replace(tzinfo=timezone.utc) if active_window.open_date.tzinfo is None else active_window.open_date
    close_date = active_window.close_date.replace(tzinfo=timezone.utc) if active_window.close_date.tzinfo is None else active_window.close_date
    if not (open_date <= now <= close_date):
        raise HTTPException(status_code=423, detail="The active cycle window is currently closed/expired.")
    return active_window

def build_check_in_response(check_in: models.CheckIn, goal: models.Goal) -> schemas.CheckInResponse:
    score = calculate_progress_score(check_in.actual_achievement, goal.target, goal.uom)
    return schemas.CheckInResponse(
        id=check_in.id,
        goal_id=check_in.goal_id,
        quarter=check_in.quarter,
        actual_achievement=check_in.actual_achievement,
        status=check_in.status,
        manager_comment=check_in.manager_comment,
        progress_score=score
    )


@router.post("/check-ins", response_model=schemas.CheckInResponse)
def create_check_in(
    check_in: schemas.CheckInCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Employee logs their quarterly achievement."""
    check_window_open(check_in.quarter, db)
    
    goal = db.query(models.Goal).filter(models.Goal.id == check_in.goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    if not goal.is_locked:
        raise HTTPException(status_code=400, detail="Cannot log achievements against an unapproved goal.")
    
    if current_user.role == models.RoleEnum.EMPLOYEE and goal.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only log check-ins for your own active goals.")

    existing_check_in = db.query(models.CheckIn).filter(
        models.CheckIn.goal_id == check_in.goal_id,
        models.CheckIn.quarter == check_in.quarter
    ).first()
    
    if existing_check_in:
        existing_check_in.actual_achievement = check_in.actual_achievement
        existing_check_in.status = check_in.status
        db.commit()
        db.refresh(existing_check_in)
        new_check_in = existing_check_in
    else:
        new_check_in = models.CheckIn(
            goal_id=check_in.goal_id,
            quarter=check_in.quarter,
            actual_achievement=check_in.actual_achievement,
            status=check_in.status
        )
        db.add(new_check_in)
        db.commit()
        db.refresh(new_check_in)
    
    return build_check_in_response(new_check_in, goal)


@router.get("/goals/{goal_id}/check-ins", response_model=List[schemas.CheckInResponse])
def get_goal_check_ins(
    goal_id: int,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Fetch all check-ins for a specific goal with pagination."""
    goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    if current_user.role == models.RoleEnum.EMPLOYEE and goal.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    check_ins = db.query(models.CheckIn).filter(models.CheckIn.goal_id == goal_id).offset(skip).limit(limit).all()
    return [build_check_in_response(ci, goal) for ci in check_ins]


@router.get("/users/{user_id}/all-check-ins", response_model=List[schemas.CheckInResponse])
def get_user_all_check_ins(
    user_id: str,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Fetch all check-ins across all goals for a specific user with pagination."""
    if current_user.role == models.RoleEnum.EMPLOYEE and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
        
    check_ins = db.query(models.CheckIn).join(
        models.Goal, models.CheckIn.goal_id == models.Goal.id
    ).filter(
        models.Goal.owner_id == user_id
    ).offset(skip).limit(limit).all()
    
    responses = []
    for ci in check_ins:
        goal = ci.goal
        score = calculate_progress_score(ci.actual_achievement, goal.target, goal.uom)
        responses.append(schemas.CheckInResponse(
            id=ci.id,
            goal_id=ci.goal_id,
            quarter=ci.quarter,
            actual_achievement=ci.actual_achievement,
            status=ci.status,
            manager_comment=ci.manager_comment,
            progress_score=score
        ))
    return responses


@router.patch("/check-ins/{check_in_id}/review", response_model=schemas.CheckInResponse)
def review_check_in(
    check_in_id: int,
    review: schemas.CheckInReview,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([models.RoleEnum.MANAGER, models.RoleEnum.ADMIN]))
):
    """Manager adds their feedback/comment to the quarterly check-in."""
    check_in = db.query(models.CheckIn).filter(models.CheckIn.id == check_in_id).first()
    if not check_in:
        raise HTTPException(status_code=404, detail="Check-in not found")
        
    check_in.manager_comment = review.manager_comment
    db.commit()
    db.refresh(check_in)
    
    return build_check_in_response(check_in, check_in.goal)


@router.get("/managers/{manager_id}/team-check-ins", response_model=List[schemas.TeamCheckInResponse])
def get_team_check_ins(
    manager_id: str,
    quarter: str,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([models.RoleEnum.MANAGER, models.RoleEnum.ADMIN]))
):
    """Fetches all quarterly check-in submissions for employees reporting directly to the manager with pagination."""
    if current_user.role == models.RoleEnum.MANAGER and current_user.id != manager_id:
        raise HTTPException(status_code=403, detail="Can only view your own team.")

    records = db.query(
        models.CheckIn.id.label("id"),
        models.CheckIn.quarter.label("quarter"),
        models.CheckIn.actual_achievement.label("actual_achievement"),
        models.CheckIn.status.label("status"),
        models.CheckIn.manager_comment.label("manager_comment"),
        models.Goal.id.label("goal_id"),
        models.Goal.title.label("goal_title"),
        models.Goal.thrust_area.label("goal_thrust_area"),
        models.Goal.target.label("goal_target"),
        models.Goal.uom.label("goal_uom"),
        models.User.id.label("employee_id"),
        models.User.name.label("employee_name")
    ).join(
        models.Goal, models.CheckIn.goal_id == models.Goal.id
    ).join(
        models.User, models.Goal.owner_id == models.User.id
    ).filter(
        models.User.manager_id == manager_id,
        models.CheckIn.quarter == quarter
    ).offset(skip).limit(limit).all()

    results = []
    for r in records:
        score = calculate_progress_score(r.actual_achievement, r.goal_target, r.goal_uom)
        results.append({
            "id": r.id,
            "quarter": r.quarter,
            "actual_achievement": r.actual_achievement,
            "status": r.status,
            "manager_comment": r.manager_comment,
            "progress_score": score,
            "goal_id": r.goal_id,
            "goal_title": r.goal_title,
            "goal_thrust_area": r.goal_thrust_area,
            "goal_target": r.goal_target,
            "goal_uom": r.goal_uom,
            "employee_id": r.employee_id,
            "employee_name": r.employee_name
        })

    return results
