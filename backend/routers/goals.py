from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
import os

from database import get_db
import models
import schemas
from auth.dependencies import get_current_user, require_role

router = APIRouter(tags=["goals"])

def calculate_progress_score(actual: float, target: float, uom: models.UoMEnum) -> float:
    try:
        if uom == models.UoMEnum.NUMERIC_MIN:
            return round((actual / target) * 100, 2)
        elif uom == models.UoMEnum.NUMERIC_MAX:
            return round((target / actual) * 100, 2)
        elif uom == models.UoMEnum.ZERO:
            return 100.0 if actual == 0 else 0.0
        elif uom == models.UoMEnum.TIMELINE:
            return round((target / actual) * 100, 2) if actual > 0 else 100.0
    except ZeroDivisionError:
        return 0.0
    return 0.0


@router.post("/goals", response_model=schemas.GoalResponse, status_code=status.HTTP_201_CREATED)
def create_goal(
    goal: schemas.GoalCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Creates a new goal while enforcing BRD rules."""
    if current_user.role == models.RoleEnum.EMPLOYEE and current_user.id != goal.owner_id:
        raise HTTPException(status_code=403, detail="Employees can only create their own goals.")

    owner = db.query(models.User).filter(models.User.id == goal.owner_id).first()
    if not owner:
        if os.getenv("DEV_AUTO_CREATE_USER", "").lower() == "true":
            owner = models.User(id=goal.owner_id, name="Dev User", email=f"{goal.owner_id}@dev.local")
            db.add(owner)
            db.commit()
            db.refresh(owner)
        else:
            raise HTTPException(status_code=400, detail="Owner does not exist. Create a user first.")

    try:
        owner_goals = db.query(models.Goal).filter(models.Goal.owner_id == goal.owner_id).with_for_update().all()

        # Rule 1: Check maximum goals limit (Max 8)
        current_goals_count = len(owner_goals)
        if current_goals_count >= 8:
            raise HTTPException(
                status_code=400,
                detail="Rule Violation: Maximum of 8 goals allowed per employee."
            )

        # Rule 2: Check total weightage limit (Max 100%)
        current_weightage = sum([g.weightage for g in owner_goals]) if owner_goals else 0.0
        if current_weightage + goal.weightage > 100.0:
            raise HTTPException(
                status_code=400,
                detail=f"Rule Violation: Adding this goal exceeds the 100% weightage limit. Current total: {current_weightage}%"
            )

        new_goal = models.Goal(
            owner_id=goal.owner_id,
            thrust_area=goal.thrust_area,
            title=goal.title,
            description=goal.description,
            uom=goal.uom,
            target=goal.target,
            weightage=goal.weightage
        )
        db.add(new_goal)
        db.flush()
        db.refresh(new_goal)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Goal could not be created. Check owner_id and payload.")

    return new_goal


@router.get("/goals/detail/{goal_id}", response_model=schemas.GoalResponse)
def get_goal_detail(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    if current_user.role == models.RoleEnum.EMPLOYEE and goal.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Populate return_comment dynamically if returned
    if goal.status == models.GoalStatusEnum.RETURNED or goal.status == models.GoalStatusEnum.DRAFT:
        latest_req = db.query(models.ApprovalRequest).filter(
            models.ApprovalRequest.goal_id == goal.id,
            models.ApprovalRequest.action == "RETURNED"
        ).order_by(models.ApprovalRequest.actioned_at.desc()).first()
        goal.return_comment = latest_req.comment if latest_req else None
    else:
        goal.return_comment = None

    return goal


@router.get("/goals/{owner_id}", response_model=List[schemas.GoalResponse])
def get_employee_goals(
    owner_id: str,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Fetches all goals for a specific employee with pagination and optimized return comments."""
    if current_user.role == models.RoleEnum.EMPLOYEE and current_user.id != owner_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    goals = db.query(models.Goal).filter(models.Goal.owner_id == owner_id).offset(skip).limit(limit).all()

    # Eliminate N+1 query: Retrieve latest returned comments in a single batch query
    if goals:
        goal_ids = [g.id for g in goals if g.status in (models.GoalStatusEnum.RETURNED, models.GoalStatusEnum.DRAFT)]
        comment_map = {}
        if goal_ids:
            subq = db.query(
                models.ApprovalRequest.goal_id,
                func.max(models.ApprovalRequest.id).label("max_id")
            ).filter(
                models.ApprovalRequest.goal_id.in_(goal_ids),
                models.ApprovalRequest.action == "RETURNED"
            ).group_by(models.ApprovalRequest.goal_id).subquery()

            latest_reqs = db.query(models.ApprovalRequest).join(
                subq,
                models.ApprovalRequest.id == subq.c.max_id
            ).all()

            comment_map = {r.goal_id: r.comment for r in latest_reqs}

        for g in goals:
            if g.status in (models.GoalStatusEnum.RETURNED, models.GoalStatusEnum.DRAFT):
                g.return_comment = comment_map.get(g.id)
            else:
                g.return_comment = None

    return goals


@router.get("/managers/{manager_id}/team-goals", response_model=List[schemas.TeamGoalResponse])
def get_team_goals(
    manager_id: str,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([models.RoleEnum.MANAGER, models.RoleEnum.ADMIN]))
):
    if current_user.role == models.RoleEnum.MANAGER and current_user.id != manager_id:
        raise HTTPException(status_code=403, detail="Can only view your own team.")

    if current_user.role == models.RoleEnum.ADMIN:
        goals = db.query(models.Goal).join(
            models.User, models.Goal.owner_id == models.User.id
        ).filter(
            models.User.role != models.RoleEnum.ADMIN
        ).offset(skip).limit(limit).all()
    else:
        goals = db.query(models.Goal).join(
            models.User, models.Goal.owner_id == models.User.id
        ).filter(
            models.User.manager_id == manager_id
        ).offset(skip).limit(limit).all()

    return goals


@router.get("/managers/{manager_id}/team", response_model=List[schemas.UserBasicWithWeightage])
def get_manager_team(
    manager_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([models.RoleEnum.MANAGER, models.RoleEnum.ADMIN]))
):
    if current_user.role == models.RoleEnum.MANAGER and current_user.id != manager_id:
        raise HTTPException(status_code=403, detail="Can only view your own team.")

    if current_user.role == models.RoleEnum.ADMIN:
        users = db.query(models.User).filter(models.User.role != models.RoleEnum.ADMIN).all()
    else:
        users = db.query(models.User).filter(models.User.manager_id == manager_id).all()

    results = []
    for u in users:
        total_w = db.query(func.sum(models.Goal.weightage)).filter(models.Goal.owner_id == u.id, models.Goal.status == models.GoalStatusEnum.APPROVED).scalar() or 0.0
        locked = db.query(models.Goal).filter(models.Goal.owner_id == u.id, models.Goal.is_locked == True).count() > 0
        results.append(schemas.UserBasicWithWeightage(
            id=u.id,
            name=u.name,
            role=u.role.value,
            total_weightage=float(total_w),
            is_locked=bool(locked)
        ))

    return results


@router.post("/goals/{goal_id}/submit", response_model=schemas.GoalResponse)
def submit_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    if current_user.role == models.RoleEnum.EMPLOYEE and goal.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only submit your own goals.")

    if goal.status != models.GoalStatusEnum.DRAFT and goal.status != models.GoalStatusEnum.RETURNED:
        raise HTTPException(status_code=400, detail=f"Cannot submit a goal in {goal.status} status.")

    goal.status = models.GoalStatusEnum.SUBMITTED
    approval_request = models.ApprovalRequest(
        goal_id=goal.id,
        submitted_by=current_user.id,
        action="SUBMITTED"
    )
    db.add(approval_request)
    db.commit()
    db.refresh(goal)
    return goal


@router.get("/goals/{goal_id}/history", response_model=List[schemas.ApprovalRequestResponse])
def get_goal_history(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    if current_user.role == models.RoleEnum.EMPLOYEE and goal.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    history = db.query(models.ApprovalRequest).filter(models.ApprovalRequest.goal_id == goal_id).order_by(models.ApprovalRequest.actioned_at.asc()).all()
    return history


@router.delete("/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    if current_user.role != models.RoleEnum.ADMIN:
        if goal.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Employees can only delete their own goals.")
        if goal.is_locked or goal.status == "approved":
            raise HTTPException(status_code=400, detail="Cannot delete an approved/locked goal.")

    db.query(models.CheckIn).filter(models.CheckIn.goal_id == goal_id).delete()
    db.query(models.ApprovalRequest).filter(models.ApprovalRequest.goal_id == goal_id).delete()
    db.query(models.AuditLog).filter(models.AuditLog.goal_id == goal_id).delete()
    db.query(models.SharedGoalLink).filter(
        (models.SharedGoalLink.base_goal_id == goal_id) | 
        (models.SharedGoalLink.recipient_id == goal.owner_id)
    ).delete()

    db.delete(goal)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/goals/{goal_id}", response_model=schemas.GoalResponse)
def update_or_approve_goal(
    goal_id: int,
    updates: schemas.GoalUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    goal = db.query(models.Goal).filter(models.Goal.id == goal_id).with_for_update().first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    if current_user.role == models.RoleEnum.EMPLOYEE:
        if goal.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Employees can only modify their own goals.")
        if updates.is_locked is not None:
            raise HTTPException(status_code=403, detail="Employees cannot lock or approve goals.")

    if goal.is_locked:
        raise HTTPException(status_code=400, detail="Goal is already locked. Admin intervention required.")

    changes = []
    if updates.thrust_area is not None and updates.thrust_area != goal.thrust_area:
        changes.append(f"Thrust area changed: {goal.thrust_area} -> {updates.thrust_area}")
        goal.thrust_area = updates.thrust_area

    if updates.title is not None and updates.title != goal.title:
        changes.append(f"Title changed: '{goal.title}' -> '{updates.title}'")
        goal.title = updates.title

    if updates.description is not None and updates.description != goal.description:
        changes.append("Description updated.")
        goal.description = updates.description

    if updates.uom is not None and updates.uom != goal.uom:
        changes.append(f"UoM changed: {goal.uom} -> {updates.uom}")
        goal.uom = models.UoMEnum(updates.uom)

    if updates.target is not None and updates.target != goal.target:
        changes.append(f"Target changed from {goal.target} to {updates.target}")
        goal.target = updates.target

    if updates.weightage is not None and updates.weightage != goal.weightage:
        current_other_weightage = db.query(func.sum(models.Goal.weightage)).filter(
            models.Goal.owner_id == goal.owner_id,
            models.Goal.id != goal.id
        ).scalar() or 0.0
        if current_other_weightage + updates.weightage > 100.0:
            raise HTTPException(
                status_code=400,
                detail=f"Rule Violation: Updating this goal's weightage to {updates.weightage}% exceeds the 100% limit for this sheet. Current other goals total: {current_other_weightage}%."
            )
        changes.append(f"Weightage changed from {goal.weightage} to {updates.weightage}")
        goal.weightage = updates.weightage

    if updates.is_locked is not None:
        if updates.is_locked:
            changes.append("Goal was APPROVED and LOCKED.")
            goal.status = models.GoalStatusEnum.APPROVED
            approval_request = models.ApprovalRequest(
                goal_id=goal.id,
                submitted_by=goal.owner_id,
                reviewed_by=current_user.id,
                action="APPROVED"
            )
            db.add(approval_request)
        goal.is_locked = updates.is_locked



    db.commit()
    db.refresh(goal)
    return goal


@router.post("/goals/{goal_id}/approve")
def approve_goal(
    goal_id: int,
    payload: schemas.GoalApproveRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([models.RoleEnum.MANAGER, models.RoleEnum.ADMIN]))
):
    goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    if current_user.role == models.RoleEnum.MANAGER:
        owner = db.query(models.User).filter(models.User.id == goal.owner_id).first()
        if not owner or owner.manager_id != current_user.id:
            raise HTTPException(status_code=403, detail="Can only approve goals for your own team.")

    if goal.status != "submitted":
        raise HTTPException(status_code=400, detail="Goal is not pending approval.")

    try:
        owner_goals = db.query(models.Goal).filter(models.Goal.owner_id == goal.owner_id).with_for_update().all()
        changes = []

        if payload.target != goal.target:
            changes.append(f"Target changed: {goal.target} -> {payload.target}")
            goal.target = payload.target

        if payload.weightage != goal.weightage:
            changes.append(f"Weightage changed: {goal.weightage} -> {payload.weightage}")
            total_excluding = sum([g.weightage for g in owner_goals if g.id != goal.id])
            if total_excluding + payload.weightage > 100.0:
                raise HTTPException(status_code=400, detail=f"Rule Violation: Approving with weightage {payload.weightage} would exceed 100% total for the owner.")
            goal.weightage = payload.weightage

        goal.status = models.GoalStatusEnum.APPROVED
        goal.is_locked = True

        approval_record = models.ApprovalRequest(
            goal_id=goal.id,
            action="APPROVED",
            submitted_by=goal.owner_id,
            reviewed_by=current_user.id
        )
        db.add(approval_record)

        changes.append("Goal was APPROVED and LOCKED.")

        db.flush()
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to approve goal due to DB error")

    return {"message": "Goal approved successfully"}


@router.post("/goals/{goal_id}/return")
def return_goal(
    goal_id: int,
    payload: schemas.GoalReturnRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([models.RoleEnum.MANAGER, models.RoleEnum.ADMIN]))
):
    goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    if current_user.role == models.RoleEnum.MANAGER:
        owner = db.query(models.User).filter(models.User.id == goal.owner_id).first()
        if not owner or owner.manager_id != current_user.id:
            raise HTTPException(status_code=403, detail="Can only return goals for your own team.")

    changes = []
    if payload.target is not None and payload.target != goal.target:
        changes.append(f"Target adjusted from {goal.target} to {payload.target}")
        goal.target = payload.target

    if payload.weightage is not None and payload.weightage != goal.weightage:
        current_other_weightage = db.query(func.sum(models.Goal.weightage)).filter(
            models.Goal.owner_id == goal.owner_id,
            models.Goal.id != goal.id
        ).scalar() or 0.0
        if current_other_weightage + payload.weightage > 100.0:
            raise HTTPException(
                status_code=400,
                detail=f"Rule Violation: Manager's suggested weightage of {payload.weightage}% exceeds the 100% limit for this sheet. Current other goals total: {current_other_weightage}%."
            )
        changes.append(f"Weightage adjusted from {goal.weightage} to {payload.weightage}")
        goal.weightage = payload.weightage

    goal.status = models.GoalStatusEnum.RETURNED
    goal.is_locked = False

    full_comment = payload.comment
    if changes:
        full_comment += "\n\n[MANAGER SUGGESTED CHANGES: " + " | ".join(changes) + "]"

    rejection_record = models.ApprovalRequest(
        goal_id=goal.id,
        action="RETURNED",
        comment=full_comment,
        submitted_by=goal.owner_id,
        reviewed_by=current_user.id
    )
    db.add(rejection_record)



    db.commit()
    return {"message": "Goal returned to employee with recommended parameter updates"}


@router.post("/goals/shared")
def push_shared_goal(
    payload: schemas.SharedGoalCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([models.RoleEnum.MANAGER, models.RoleEnum.ADMIN]))
):
    base_goal = models.Goal(
        title=f"[SHARED] {payload.title}",
        description=payload.description,
        thrust_area=payload.thrust_area,
        uom=models.UoMEnum(payload.uom) if payload.uom else models.UoMEnum.NUMERIC_MIN,
        target=payload.target,
        weightage=payload.weightage,
        owner_id=current_user.id,
        is_locked=True,
        status=models.GoalStatusEnum.APPROVED
    )
    db.add(base_goal)
    db.flush()

    for recipient_id in payload.recipient_ids:
        recipient = db.query(models.User).filter(models.User.id == recipient_id).first()
        if not recipient:
            raise HTTPException(status_code=404, detail=f"Recipient user '{recipient_id}' not found")
        if recipient.role != models.RoleEnum.EMPLOYEE:
            raise HTTPException(
                status_code=400,
                detail=f"Rule Violation: Pushing tasks is strictly limited to standard Employees. '{recipient.name}' is a '{recipient.role.value}'."
            )

        emp_goal = models.Goal(
            title=payload.title,
            description=payload.description,
            thrust_area=payload.thrust_area,
            uom=models.UoMEnum(payload.uom) if payload.uom else models.UoMEnum.NUMERIC_MIN,
            target=payload.target,
            weightage=payload.weightage,
            owner_id=recipient_id,
            status=models.GoalStatusEnum.DRAFT,
            is_locked=False
        )
        db.add(emp_goal)
        db.flush()

        has_locked_goals = db.query(models.Goal).filter(
            models.Goal.owner_id == recipient_id,
            models.Goal.is_locked == True
        ).count() > 0

        if has_locked_goals:
            recipient_goals = db.query(models.Goal).filter(models.Goal.owner_id == recipient_id).all()
            for rg in recipient_goals:
                rg.is_locked = False
                rg.status = models.GoalStatusEnum.DRAFT

        link = models.SharedGoalLink(
            base_goal_id=base_goal.id,
            primary_owner_id=payload.primary_owner_id,
            recipient_id=recipient_id,
            custom_weightage=payload.weightage
        )
        db.add(link)

    db.commit()
    return {"message": f"Shared goal successfully pushed to {len(payload.recipient_ids)} employees."}


@router.patch("/goals/shared/{link_id}/weightage", response_model=schemas.SharedGoalLinkResponse)
def update_shared_weightage(
    link_id: int,
    update: schemas.SharedGoalWeightageUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    link = db.query(models.SharedGoalLink).filter(models.SharedGoalLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Shared goal link not found")

    if current_user.role == models.RoleEnum.EMPLOYEE and link.recipient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only update your own shared goal weightage.")

    link.custom_weightage = update.custom_weightage
    db.commit()
    db.refresh(link)
    return link


@router.post("/goals/shared/{base_goal_id}/achievement")
def sync_shared_achievement(
    base_goal_id: int,
    achievement_update: schemas.SharedGoalAchievementUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    base_goal = db.query(models.Goal).filter(models.Goal.id == base_goal_id).first()
    if not base_goal:
        raise HTTPException(status_code=404, detail="Base goal not found")

    if current_user.role == models.RoleEnum.EMPLOYEE and base_goal.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the primary owner can broadcast achievements.")

    links = db.query(models.SharedGoalLink).filter(models.SharedGoalLink.base_goal_id == base_goal_id).all()
    if not links:
        return {"detail": "No shared links found."}

    check_ins = db.query(models.CheckIn).filter(
        models.CheckIn.goal_id == base_goal_id,
        models.CheckIn.quarter == achievement_update.quarter
    ).all()

    for ci in check_ins:
        ci.actual_achievement = achievement_update.actual_achievement

    if not check_ins:
        primary_ci = models.CheckIn(
            goal_id=base_goal_id,
            quarter=achievement_update.quarter,
            actual_achievement=achievement_update.actual_achievement,
            status=models.StatusEnum.NOT_STARTED
        )
        db.add(primary_ci)

    db.commit()
    return {"detail": "Achievement synced successfully"}
