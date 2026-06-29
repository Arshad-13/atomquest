from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, aliased
from sqlalchemy import func
from typing import List
import os

from database import get_db
import models
import schemas
from auth.dependencies import require_role
from auth.security import get_password_hash

router = APIRouter(tags=["admin"])

# --- CYCLES MANAGEMENT ---

@router.get("/cycles", response_model=List[schemas.CycleWindowResponse])
def get_all_cycles(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([models.RoleEnum.ADMIN]))
):
    """Admin route to view all configured cycle windows."""
    return db.query(models.CycleWindow).order_by(models.CycleWindow.open_date.desc()).all()


@router.get("/cycles/active", response_model=schemas.CycleWindowResponse)
def get_active_cycle(db: Session = Depends(get_db)):
    """Returns the currently active window. Frontend calls this on load."""
    active = db.query(models.CycleWindow).filter(models.CycleWindow.is_active == True).first()
    if not active:
        raise HTTPException(status_code=404, detail="No active cycle window.")
    return active


@router.post("/cycles", response_model=schemas.CycleWindowResponse)
def create_cycle_window(
    cycle: schemas.CycleWindowCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([models.RoleEnum.ADMIN]))
):
    """Admin creates a cycle window."""
    new_window = models.CycleWindow(
        period_name=cycle.period_name,
        open_date=cycle.open_date,
        close_date=cycle.close_date,
        is_active=False
    )
    db.add(new_window)
    db.commit()
    db.refresh(new_window)
    return new_window


@router.patch("/cycles/{cycle_id}/activate", response_model=schemas.CycleWindowResponse)
def activate_cycle_window(
    cycle_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([models.RoleEnum.ADMIN]))
):
    """Admin opens a window. Deactivates currently active one instantly."""
    new_active = db.query(models.CycleWindow).filter(models.CycleWindow.id == cycle_id).first()
    if not new_active:
        raise HTTPException(status_code=404, detail="Cycle window not found.")
        
    active_windows = db.query(models.CycleWindow).filter(models.CycleWindow.is_active == True).all()
    for w in active_windows:
        w.is_active = False
        
    new_active.is_active = True
    db.commit()
    db.refresh(new_active)
    return new_active


# --- ADMIN CONTROLS & OVERRIDES ---

@router.get("/admin/completion-dashboard", response_model=List[schemas.AdminCompletionRow])
def get_admin_completion_dashboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([models.RoleEnum.ADMIN]))
):
    employees = db.query(models.User).filter(models.User.role == models.RoleEnum.EMPLOYEE).all()
    dashboard_data = []
    
    for emp in employees:
        goals = db.query(models.Goal).filter(models.Goal.owner_id == emp.id).all()
        goals_submitted = sum(1 for g in goals if g.status != models.GoalStatusEnum.DRAFT)
        goals_approved = sum(1 for g in goals if g.status == models.GoalStatusEnum.APPROVED)
        
        check_in_completed = False
        active_cycle = db.query(models.CycleWindow).filter(models.CycleWindow.is_active == True).first()
        if active_cycle:
            ci_count = db.query(models.CheckIn).join(models.Goal).filter(
                models.Goal.owner_id == emp.id,
                models.CheckIn.quarter == active_cycle.period_name.value
            ).count()
            if len(goals) > 0 and ci_count >= len(goals):
                check_in_completed = True
                
        status_category = "not_started"
        if goals_approved > 0:
            status_category = "complete" if goals_approved == len(goals) else "in_progress"
        elif goals_submitted > 0:
            status_category = "in_progress"
            
        dashboard_data.append({
            "user_id": emp.id,
            "name": emp.name,
            "department": "Engineering" if "@eng" in emp.email else "Management",
            "goals_submitted": goals_submitted,
            "goals_approved": goals_approved,
            "check_in_completed": check_in_completed,
            "status_category": status_category
        })

    return dashboard_data


@router.get("/admin/goals/locked")
def get_all_locked_goals(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([models.RoleEnum.ADMIN]))
):
    """Admin route to fetch all locked goals across the entire organization with pagination."""
    locked_goals = db.query(
        models.Goal.id,
        models.Goal.title,
        models.Goal.thrust_area,
        models.Goal.weightage,
        models.User.name.label("owner_name"),
        models.User.email.label("owner_email")
    ).join(
        models.User, models.Goal.owner_id == models.User.id
    ).filter(
        models.Goal.is_locked == True
    ).offset(skip).limit(limit).all()
    
    return [dict(g._mapping) for g in locked_goals]


@router.post("/admin/goals/{goal_id}/unlock")
def admin_unlock_goal(
    goal_id: int, 
    payload: schemas.AdminUnlockRequest, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(require_role([models.RoleEnum.ADMIN]))
):
    """Executes a system-level override to unlock a goal and stamps the audit log."""
    goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found.")
    if not goal.is_locked:
        raise HTTPException(status_code=400, detail="Goal is already unlocked.")

    goal.is_locked = False
    goal.status = models.GoalStatusEnum.DRAFT

    db.commit()

    return {"message": "Goal successfully unlocked and audit log updated."}


@router.get("/admin/shared-goals")
def get_all_shared_goals(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([models.RoleEnum.ADMIN]))
):
    """Fetch all pushed shared goals in the system."""
    shared_goals = db.query(models.Goal).filter(models.Goal.title.like("[SHARED]%")).all()
    results = []
    for sg in shared_goals:
        links = db.query(models.SharedGoalLink).filter(models.SharedGoalLink.base_goal_id == sg.id).all()
        recipients = []
        for l in links:
            rec = db.query(models.User).filter(models.User.id == l.recipient_id).first()
            if rec:
                recipients.append({"id": rec.id, "name": rec.name})
        results.append({
            "id": sg.id,
            "title": sg.title,
            "description": sg.description,
            "thrust_area": sg.thrust_area,
            "weightage": sg.weightage,
            "recipients": recipients
        })
    return results


@router.post("/admin/shared-goals/{base_goal_id}/cancel")
def cancel_shared_goal(
    base_goal_id: int, 
    payload: schemas.AdminUnlockRequest, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(require_role([models.RoleEnum.ADMIN]))
):
    """Cancel (delete) a shared goal, cascading deletion to all mirrored employee goals and links."""
    base_goal = db.query(models.Goal).filter(models.Goal.id == base_goal_id).first()
    if not base_goal:
        raise HTTPException(status_code=404, detail="Shared goal not found")
        
    links = db.query(models.SharedGoalLink).filter(models.SharedGoalLink.base_goal_id == base_goal_id).all()
    recipient_ids = [l.recipient_id for l in links]
    
    title_clean = base_goal.title.replace("[SHARED] ", "")
    mirrored_goals = db.query(models.Goal).filter(
        models.Goal.owner_id.in_(recipient_ids),
        models.Goal.title == title_clean
    ).all()
    
    for mg in mirrored_goals:
        db.query(models.CheckIn).filter(models.CheckIn.goal_id == mg.id).delete()
        db.query(models.ApprovalRequest).filter(models.ApprovalRequest.goal_id == mg.id).delete()
        db.delete(mg)
        
    db.query(models.SharedGoalLink).filter(models.SharedGoalLink.base_goal_id == base_goal_id).delete()
    db.query(models.CheckIn).filter(models.CheckIn.goal_id == base_goal.id).delete()
    db.query(models.ApprovalRequest).filter(models.ApprovalRequest.goal_id == base_goal.id).delete()
    db.delete(base_goal)
    
    db.commit()
    return {"message": "Shared goal successfully canceled and cleaned up across all sheets."}


# --- USER DIRECTORY MANAGEMENT ---

@router.get("/admin/users", response_model=List[schemas.UserDirectoryResponse])
def get_all_users_directory(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([models.RoleEnum.ADMIN]))
):
    """Admin route to fetch all users in the system, manager names, and sheet stats with pagination."""
    users = db.query(models.User).order_by(models.User.name).offset(skip).limit(limit).all()
    results = []
    for u in users:
        total_w = db.query(func.sum(models.Goal.weightage)).filter(models.Goal.owner_id == u.id, models.Goal.status == models.GoalStatusEnum.APPROVED).scalar() or 0.0
        locked = db.query(models.Goal).filter(models.Goal.owner_id == u.id, models.Goal.is_locked == True).count() > 0
        mgr_name = None
        if u.manager_id:
            mgr = db.query(models.User).filter(models.User.id == u.manager_id).first()
            if mgr:
                mgr_name = mgr.name
                
        results.append(schemas.UserDirectoryResponse(
            id=u.id,
            name=u.name,
            email=u.email,
            role=u.role.value,
            total_weightage=float(total_w),
            is_locked=bool(locked),
            manager_id=u.manager_id,
            manager_name=mgr_name
        ))
    return results


@router.post("/admin/users")
def provision_new_user(
    payload: schemas.UserCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(require_role([models.RoleEnum.ADMIN]))
):
    """HR Admin route to manually provision a new employee, manager, or admin."""
    # Check if email is unique
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists.")

    new_id = payload.email.split('@')[0] + "_local"
    hashed = get_password_hash(payload.password)
    
    new_user = models.User(
        id=new_id,
        name=payload.name,
        email=payload.email,
        role=payload.role,
        hashed_password=hashed,
        manager_id=payload.manager_id
    )
    db.add(new_user)
    
    audit = models.AuditLog(
        changed_by=current_user.id,
        change_summary=f"EMPLOYEE PROVISIONED: Name={payload.name} | Role={payload.role.value}"
    )
    db.add(audit)
    db.commit()
    db.refresh(new_user)
    
    return {"message": f"User {payload.name} created successfully with ID {new_id}."}


@router.post("/admin/users/{user_id}/reset-password")
def reset_user_password(
    user_id: str,
    payload: schemas.ResetPasswordRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([models.RoleEnum.ADMIN]))
):
    """HR Admin override to force-reset a password for demo/local users."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    hashed = get_password_hash(payload.password)
    user.hashed_password = hashed
    
    audit = models.AuditLog(
        changed_by=current_user.id,
        change_summary=f"PASSWORD RESET FORCED: TargetUser={user.name} ({user.email})"
    )
    db.add(audit)
    db.commit()
    
    return {"message": f"Password for {user.name} successfully reset."}


# --- AUDIT COMPLIANCE LEDGER ---

@router.get("/admin/audit-logs", response_model=List[schemas.AdminAuditLogResponse])
def get_audit_logs(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([models.RoleEnum.ADMIN]))
):
    """Fetches the immutable system audit trail with resolved names and pagination."""
    Employee = aliased(models.User)
    Changer = aliased(models.User)

    logs = db.query(
        models.AuditLog.id,
        models.AuditLog.timestamp,
        models.AuditLog.goal_id,
        models.Goal.title.label("goal_title"),
        Employee.name.label("employee_name"),
        Changer.name.label("changed_by_name"),
        models.AuditLog.change_summary
    ).outerjoin(
        models.Goal, models.AuditLog.goal_id == models.Goal.id
    ).outerjoin(
        Employee, models.Goal.owner_id == Employee.id
    ).join(
        Changer, models.AuditLog.changed_by == Changer.id
    ).order_by(models.AuditLog.timestamp.desc()).offset(skip).limit(limit).all()

    return [dict(log._mapping) for log in logs]


# --- ESCALATION CENTER ---

@router.get("/admin/escalation-rules")
def get_escalation_rules(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([models.RoleEnum.ADMIN]))
):
    return db.query(models.EscalationRule).all()


@router.patch("/admin/escalation-rules/{rule_id}")
def update_escalation_rule(
    rule_id: int,
    payload: schemas.EscalationRuleUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([models.RoleEnum.ADMIN]))
):
    rule = db.query(models.EscalationRule).filter(models.EscalationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
        
    rule.days_threshold = payload.days_threshold
    rule.is_active = payload.is_active
    db.commit()
    return {"message": "Rule updated."}


@router.get("/admin/escalation-logs", response_model=List[schemas.EscalationLogResponse])
def get_escalation_logs(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([models.RoleEnum.ADMIN]))
):
    """Admin route to fetch escalation logs resolving real employee and manager names with pagination."""
    Employee = aliased(models.User)
    Manager = aliased(models.User)
    
    logs = db.query(
        models.EscalationLog.id,
        models.EscalationLog.triggered_at,
        models.EscalationLog.is_resolved,
        models.EscalationRule.trigger_event,
        Employee.name.label("employee_name"),
        Manager.name.label("manager_name")
    ).join(
        models.EscalationRule, models.EscalationLog.rule_id == models.EscalationRule.id
    ).join(
        Employee, models.EscalationLog.employee_id == Employee.id
    ).outerjoin(
        Manager, models.EscalationLog.manager_id == Manager.id
    ).offset(skip).limit(limit).all()
    
    results = []
    for l in logs:
        results.append({
            "id": l.id,
            "trigger_event": l.trigger_event,
            "employee_name": l.employee_name,
            "manager_name": l.manager_name or "Assigned Manager",
            "triggered_at": l.triggered_at,
            "is_resolved": l.is_resolved
        })
    return results
