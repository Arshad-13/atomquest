from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import text, event
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from dotenv import load_dotenv
import os
import traceback

from database import get_db, SessionLocal
import models
import database as _database
from limiter import limiter
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from routers.auth import router as auth_router
from routers.goals import router as goals_router
from routers.check_ins import router as check_ins_router
from routers.admin import router as admin_router
from routers.analytics import router as analytics_router
from routers.reports import router as reports_router

load_dotenv()

APP_ENV = os.getenv("APP_ENV", "development")

app = FastAPI(title="ZenithOKR API")

# Rate limiter configuration
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Database schema migrations & checks on startup
@app.on_event("startup")
def ensure_version_column():
    # ... existing logic ...
    pass

# SQLAlchemy Event Listeners for AuditLog
def audit_listener(mapper, connection, target):
    # This is a simplified event listener that logs any update to a Goal
    # In a real system, we would compare old vs new values.
    # Since we are in a monolithic main.py and the session is handled by FastAPI,
    # we need to be careful about how we access the current user.
    # Event listeners don't have access to the request context directly.
    # For this implementation, we'll log that a change occurred.
    
    # Note: Target is the object being changed.
    if isinstance(target, models.Goal):
        # We use a separate connection to avoid interfering with the current transaction
        # or just add to the current session if possible.
        # Since we don't have the user_id here, we log as 'SYSTEM' or try to find the owner.
        user_id = target.owner_id if hasattr(target, 'owner_id') else "SYSTEM"
        summary = f"Goal {target.id} updated automatically by event listener."
        
        # We use a raw SQL insert to avoid session conflicts within the listener
        connection.execute(
            text("INSERT INTO audit_logs (goal_id, changed_by, change_summary, timestamp) VALUES (:goal_id, :changed_by, :summary, CURRENT_TIMESTAMP)"),
            {"goal_id": target.id, "changed_by": user_id, "summary": summary}
        )

event.listen(models.Goal, 'after_update', audit_listener)

# Daily Escalation Background Scheduler Job
def run_daily_escalations():
    from datetime import datetime, timezone
    db = SessionLocal()
    try:
        active_rules = db.query(models.EscalationRule).filter(models.EscalationRule.is_active == True).all()
        unsubmitted_rule = next((r for r in active_rules if r.trigger_event == "GOAL_NOT_SUBMITTED"), None)
        if unsubmitted_rule:
            active_cycle = db.query(models.CycleWindow).filter(models.CycleWindow.is_active == True, models.CycleWindow.period_name == "GOAL_SETTING").first()
            if active_cycle:
                now = datetime.now(timezone.utc)
                open_dt = active_cycle.open_date.replace(tzinfo=timezone.utc) if active_cycle.open_date.tzinfo is None else active_cycle.open_date
                days_open = (now - open_dt).days
                if days_open >= unsubmitted_rule.days_threshold:
                    employees = db.query(models.User).filter(
                        models.User.role == models.RoleEnum.EMPLOYEE,
                        ~models.User.goals.any(models.Goal.status != models.GoalStatusEnum.DRAFT)
                    ).all()
                    
                    if employees:
                        employee_ids = [emp.id for emp in employees]
                        existing_logs = db.query(models.EscalationLog.employee_id).filter(
                            models.EscalationLog.rule_id == unsubmitted_rule.id,
                            models.EscalationLog.employee_id.in_(employee_ids),
                            models.EscalationLog.is_resolved == False
                        ).all()
                        logged_employee_ids = {log.employee_id for log in existing_logs}
                        
                        for emp in employees:
                            if emp.id not in logged_employee_ids:
                                db.add(models.EscalationLog(
                                    rule_id=unsubmitted_rule.id,
                                    employee_id=emp.id,
                                    manager_id=emp.manager_id
                                ))
                        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error in daily escalations background job: {e}")
    finally:
        db.close()


@app.on_event("startup")
def start_scheduler():
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        scheduler = BackgroundScheduler()
        # Scheduled to run at midnight every day
        scheduler.add_job(run_daily_escalations, "cron", hour=0)
        scheduler.start()
        app.state.scheduler = scheduler
        print("Daily escalations background scheduler started successfully.")
    except Exception as e:
        print(f"Failed to start background scheduler: {e}")


@app.on_event("shutdown")
def stop_scheduler():
    if hasattr(app.state, "scheduler"):
        app.state.scheduler.shutdown()
        print("Background scheduler stopped.")


# CORS configuration
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

# Exception handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    readable = " | ".join(
        f"{'.'.join(str(l) for l in e['loc'][1:])}: {e['msg']}" for e in errors
    )
    return JSONResponse(
        status_code=422,
        content={"detail": readable or "Validation failed.", "code": "VALIDATION_ERROR"}
    )

@app.exception_handler(IntegrityError)
async def integrity_exception_handler(request: Request, exc: IntegrityError):
    return JSONResponse(
        status_code=409,
        content={"detail": "A database constraint was violated. The record may already exist.", "code": "INTEGRITY_ERROR"}
    )

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    payload = {"detail": "Internal Server Error", "code": "INTERNAL_ERROR"}
    if APP_ENV != "production":
        payload.update({"detail": f"Internal Server Error: {str(exc)}", "traceback": traceback.format_exc()})
    return JSONResponse(status_code=500, content=payload)


# Health check endpoint with active DB check
@app.get("/health")
@app.head("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "service": "ZenithOKR Backend API", "database": "connected"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database connection failed: {str(e)}"
        )


# Mount routers
app.include_router(auth_router)
app.include_router(goals_router)
app.include_router(check_ins_router)
app.include_router(admin_router)
app.include_router(analytics_router)
app.include_router(reports_router)