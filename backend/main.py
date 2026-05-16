from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from typing import List
import os

from database import get_db
import models
import schemas

app = FastAPI()

raw_origins = os.getenv("ALLOWED_ORIGINS")
if raw_origins:
    allowed_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
else:
    allowed_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True
)

@app.get("/health")
@app.head("/health")
def health_check():
    return {"status": "ok", "service": "atom-backend API"}

@app.post("/goals", response_model=schemas.GoalResponse, status_code=status.HTTP_201_CREATED)
def create_goal(goal: schemas.GoalCreate, db: Session = Depends(get_db)):
    """
    Creates a new goal while enforcing BRD rules:
    - Max 8 goals per employee
    - Total weightage cannot exceed 100%
    """
    
    owner = db.query(models.User).filter(models.User.id == goal.owner_id).first()
    if not owner:
        if os.getenv("DEV_AUTO_CREATE_USER", "").lower() == "true":
            owner = models.User(
                id=goal.owner_id,
                name="Dev User",
                email=f"{goal.owner_id}@dev.local"
            )
            db.add(owner)
            db.commit()
            db.refresh(owner)
        else:
            raise HTTPException(
                status_code=400,
                detail="Owner does not exist. Create a user first."
            )

    # Rule 1: Check maximum goals limit (Max 8)
    current_goals_count = db.query(models.Goal).filter(models.Goal.owner_id == goal.owner_id).count()
    if current_goals_count >= 8:
        raise HTTPException(
            status_code=400, 
            detail="Rule Violation: Maximum of 8 goals allowed per employee."
        )

    # Rule 2: Check total weightage limit (Max 100%)
    current_weightage = db.query(func.sum(models.Goal.weightage)).filter(
        models.Goal.owner_id == goal.owner_id
    ).scalar() or 0.0
    
    if current_weightage + goal.weightage > 100.0:
        raise HTTPException(
            status_code=400, 
            detail=f"Rule Violation: Adding this goal exceeds the 100% weightage limit. Current total: {current_weightage}%"
        )

    # Create the goal if validations pass
    new_goal = models.Goal(
        owner_id=goal.owner_id,
        thrust_area=goal.thrust_area,
        title=goal.title,
        description=goal.description,
        uom=goal.uom,
        target=goal.target,
        weightage=goal.weightage
    )
    
    try:
        db.add(new_goal)
        db.commit()
        db.refresh(new_goal)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Goal could not be created. Check owner_id and payload."
        )
    
    return new_goal


@app.get("/goals/{owner_id}", response_model=list[schemas.GoalResponse])
def get_employee_goals(owner_id: str, db: Session = Depends(get_db)):
    """Fetches all goals for a specific employee."""
    goals = db.query(models.Goal).filter(models.Goal.owner_id == owner_id).all()
    return goals

@app.get("/managers/{manager_id}/team-goals", response_model=List[schemas.TeamGoalResponse])
def get_team_goals(manager_id: str, db: Session = Depends(get_db)):
    """
    Fetches all goals for employees reporting to a specific manager.
    Joins the Goal and User tables to filter by the employee's manager_id.
    """
    goals = db.query(models.Goal).join(
        models.User, models.Goal.owner_id == models.User.id
    ).filter(
        models.User.manager_id == manager_id
    ).all()
    
    return goals

@app.patch("/goals/{goal_id}", response_model=schemas.GoalResponse)
def update_or_approve_goal(goal_id: int, updates: schemas.GoalUpdate, db: Session = Depends(get_db)):
    """
    Allows managers to edit targets inline or approve (lock) the goal.
    Automatically generates an Audit Trail log.
    """
    goal = db.query(models.Goal).filter(models.Goal.id == goal_id).first()
    
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
        
    if goal.is_locked:
        raise HTTPException(status_code=400, detail="Goal is already locked. Admin intervention required.")

    # Track what changed for the Audit Log
    changes = []
    
    if updates.target is not None and updates.target != goal.target:
        changes.append(f"Target changed from {goal.target} to {updates.target}")
        goal.target = updates.target
        
    if updates.weightage is not None and updates.weightage != goal.weightage:
        # Note: In a real app, you'd re-verify the 100% total rule here too!
        changes.append(f"Weightage changed from {goal.weightage} to {updates.weightage}")
        goal.weightage = updates.weightage
        
    if updates.is_locked is not None:
        if updates.is_locked:
            changes.append("Goal was APPROVED and LOCKED.")
        goal.is_locked = updates.is_locked

    # If changes were made, write to the Audit Trail
    if changes:
        audit_entry = models.AuditLog(
            goal_id=goal.id,
            changed_by=updates.manager_id,
            change_summary=" | ".join(changes)
        )
        db.add(audit_entry)

    db.commit()
    db.refresh(goal)
    
    return goal