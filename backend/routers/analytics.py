from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
import models
import schemas
from auth.dependencies import get_current_user
from routers.goals import calculate_progress_score

router = APIRouter(tags=["analytics"])

@router.get("/managers/{manager_id}/analytics")
def get_manager_analytics(
    manager_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Aggregates average scores and check-in completion heatmaps for a manager's team."""
    if current_user.id != manager_id and current_user.role != models.RoleEnum.ADMIN:
        raise HTTPException(status_code=403, detail="Unauthorized access to team analytics.")

    team = db.query(models.User).filter(models.User.manager_id == manager_id).all()
    team_ids = [u.id for u in team]

    goals = db.query(models.Goal).filter(models.Goal.owner_id.in_(team_ids), models.Goal.is_locked == True).all()
    checkins = db.query(models.CheckIn).join(models.Goal).filter(models.Goal.owner_id.in_(team_ids)).all()

    bar_data = []
    heatmap_data = []
    quarters = ["Q1", "Q2", "Q3", "Q4"]

    for emp in team:
        emp_goals = [g for g in goals if g.owner_id == emp.id]
        
        # Calculate Average Score
        latest_scores = []
        for g in emp_goals:
            g_checkins = [c for c in checkins if c.goal_id == g.id]
            if g_checkins:
                latest_ci = sorted(g_checkins, key=lambda x: x.quarter)[-1]
                score = calculate_progress_score(latest_ci.actual_achievement, g.target, g.uom)
                latest_scores.append(min(score, 100))
        
        avg_score = sum(latest_scores) / len(latest_scores) if latest_scores else 0
        bar_data.append({"name": emp.name, "avgScore": round(avg_score, 1)})

        # Calculate Heatmap (Completion Rates)
        emp_heatmap = {"name": emp.name}
        for q in quarters:
            if not emp_goals:
                emp_heatmap[q] = 0
            else:
                q_checkins = len([c for c in checkins if c.goal_id in [g.id for g in emp_goals] and c.quarter == q])
                completion_rate = min(round((q_checkins / len(emp_goals)) * 100), 100)
                emp_heatmap[q] = completion_rate
                
        heatmap_data.append(emp_heatmap)

    return {
        "bar_data": bar_data,
        "heatmap_data": heatmap_data
    }


@router.get("/employees/{employee_id}/analytics")
def get_employee_analytics(
    employee_id: str, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """Generates personalized analytics data for the Recharts frontend."""
    if current_user.id != employee_id and current_user.role not in [models.RoleEnum.MANAGER, models.RoleEnum.ADMIN]:
        raise HTTPException(status_code=403, detail="Unauthorized access to analytics.")

    goals = db.query(models.Goal).filter(models.Goal.owner_id == employee_id).all()
    goal_ids = [g.id for g in goals]
    checkins = db.query(models.CheckIn).filter(models.CheckIn.goal_id.in_(goal_ids)).all()

    quarters = ["Q1", "Q2", "Q3", "Q4"]
    line_data = []
    
    for q in quarters:
        q_data = {"quarter": q}
        for g in goals:
            short_title = g.title[:15] + "..." if len(g.title) > 15 else g.title
            ci = next((c for c in checkins if c.goal_id == g.id and c.quarter.value == q), None)
            
            if ci:
                score = calculate_progress_score(ci.actual_achievement, g.target, g.uom)
                q_data[short_title] = score
            else:
                q_data[short_title] = 0
        line_data.append(q_data)

    thrust_areas = {}
    for g in goals:
        if g.thrust_area not in thrust_areas:
            thrust_areas[g.thrust_area] = []
        
        g_checkins = [c for c in checkins if c.goal_id == g.id]
        if g_checkins:
            latest_ci = sorted(g_checkins, key=lambda x: x.quarter.value)[-1]
            score = calculate_progress_score(latest_ci.actual_achievement, g.target, g.uom)
            thrust_areas[g.thrust_area].append(score)
        else:
            thrust_areas[g.thrust_area].append(0)

    radar_data = []
    for ta, scores in thrust_areas.items():
        avg = sum(scores) / len(scores) if scores else 0
        radar_data.append({
            "subject": ta,
            "score": round(avg, 1),
            "fullMark": 100
        })

    return {
        "line_data": line_data,
        "radar_data": radar_data
    }


@router.get("/employees/{employee_id}/profile")
def get_employee_profile(
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Fetches the profile info of the target employee, including their active manager's name dynamically."""
    if current_user.role != models.RoleEnum.ADMIN and current_user.id != employee_id:
        target_user = db.query(models.User).filter(models.User.id == employee_id).first()
        if not target_user or target_user.manager_id != current_user.id:
            raise HTTPException(status_code=403, detail="Forbidden")

    u = db.query(models.User).filter(models.User.id == employee_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Employee not found")

    mgr_name = None
    if u.manager_id:
        mgr = db.query(models.User).filter(models.User.id == u.manager_id).first()
        if mgr:
            mgr_name = mgr.name

    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "role": u.role.value,
        "manager_id": u.manager_id,
        "manager_name": mgr_name
    }
