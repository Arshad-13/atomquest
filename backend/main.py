from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
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