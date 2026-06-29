from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import io
import csv

from database import get_db
import models
import schemas
from auth.dependencies import require_role, get_current_user
from routers.goals import calculate_progress_score

router = APIRouter(tags=["reports"])

@router.get("/reports/achievement")
def get_achievement_report(
    format: Optional[str] = "json", 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(require_role([models.RoleEnum.ADMIN]))
):
    """Fetches planned vs actual data. Returns JSON by default, or streams a CSV if requested."""
    records = db.query(
        models.CheckIn.quarter,
        models.User.name.label("employee_name"),
        models.Goal.title.label("goal_title"),
        models.Goal.target.label("planned_target"),
        models.Goal.uom,
        models.CheckIn.actual_achievement,
        models.CheckIn.status
    ).join(
        models.Goal, models.CheckIn.goal_id == models.Goal.id
    ).join(
        models.User, models.Goal.owner_id == models.User.id
    ).order_by(models.CheckIn.quarter, models.User.name).all()

    if format == "csv":
        stream = io.StringIO()
        writer = csv.writer(stream)
        writer.writerow(["Quarter", "Employee", "Goal", "UoM", "Planned Target", "Actual Achievement", "Status"])
        
        for r in records:
            writer.writerow([r.quarter, r.employee_name, r.goal_title, r.uom, r.planned_target, r.actual_achievement, r.status])
        
        response = StreamingResponse(iter([stream.getvalue()]), media_type="text/csv")
        response.headers["Content-Disposition"] = "attachment; filename=achievement_report.csv"
        return response

    return [dict(r._mapping) for r in records]


@router.get("/reports/completion")
def get_completion_report(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([models.RoleEnum.ADMIN]))
):
    """Aggregates check-in completion rates by Department and Quarter for the visual chart."""
    users = db.query(models.User).filter(models.User.role != models.RoleEnum.ADMIN).all()
    check_ins = db.query(models.CheckIn).join(models.Goal).all()
    
    data = {
        "Engineering": {"department": "Engineering", "Q1": 0, "Q2": 0, "Q3": 0, "Q4": 0},
        "Management": {"department": "Management", "Q1": 0, "Q2": 0, "Q3": 0, "Q4": 0}
    }
    
    quarters = ["Q1", "Q2", "Q3", "Q4"]
    
    for dept in data.keys():
        dept_users = [u for u in users if (u.role == models.RoleEnum.MANAGER and dept == "Management") or (u.role == models.RoleEnum.EMPLOYEE and dept == "Engineering")]
        user_ids = [u.id for u in dept_users]
        
        for q in quarters:
            q_checkins = len([c for c in check_ins if c.quarter.value == q and c.goal.owner_id in user_ids])
            expected_checkins = len(user_ids) * 3
            
            if expected_checkins > 0:
                rate = min(round((q_checkins / expected_checkins) * 100), 100)
                data[dept][q] = rate
    
    return list(data.values())


@router.get("/admin/executive-analytics", response_model=schemas.AdminAnalyticsResponse)
def get_admin_executive_analytics(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """
    Advanced executive analytics endpoint. Aggregates organizational health metrics,
    strategic alignment distributions, operational metrics, and leadership performance metrics.
    """
    users = db.query(models.User).filter(models.User.role != models.RoleEnum.ADMIN).all()
    goals = db.query(models.Goal).all()
    checkins = db.query(models.CheckIn).all()

    managers = {u.id: u for u in users if u.role == models.RoleEnum.MANAGER}
    quarters = ["Q1", "Q2", "Q3", "Q4"]

    # 1. QoQ Trends at Department Level
    qoq_trends = []
    for q in quarters:
        eng_scores = []
        mgmt_scores = []
        
        q_checkins = [c for c in checkins if c.quarter.value == q]
        for c in q_checkins:
            goal = db.query(models.Goal).filter(models.Goal.id == c.goal_id).first()
            if not goal:
                continue
                
            owner = next((u for u in users if u.id == goal.owner_id), None)
            if not owner:
                continue
                
            score = calculate_progress_score(c.actual_achievement, goal.target, goal.uom)
            
            if owner.role == models.RoleEnum.EMPLOYEE:
                eng_scores.append(score)
            elif owner.role == models.RoleEnum.MANAGER:
                mgmt_scores.append(score)
                
        qoq_trends.append({
            "quarter": q,
            "Engineering": round(sum(eng_scores) / len(eng_scores), 1) if eng_scores else 0.0,
            "Management": round(sum(mgmt_scores) / len(mgmt_scores), 1) if mgmt_scores else 0.0
        })

    # 2. Goal Distribution by Strategic Thrust Area (Pie Chart)
    thrust_counts = {}
    for g in goals:
        thrust_counts[g.thrust_area] = thrust_counts.get(g.thrust_area, 0) + 1
        
    goal_distribution = [
        {"name": area, "value": count} for area, count in thrust_counts.items()
    ]

    # 3. UoM Breakdown Strategy (Bar Chart)
    uom_counts = {"min": 0, "max": 0, "timeline": 0, "zero": 0}
    for g in goals:
        if g.uom in uom_counts:
            uom_counts[g.uom] += 1
            
    uom_breakdown = [
        {"name": uom.upper() if uom != 'min' and uom != 'max' else ('Higher Better' if uom == 'min' else 'Lower Better'), "count": count}
        for uom, count in uom_counts.items()
    ]

    # 4. L1 Manager Effectiveness (Sorted Bar Chart)
    manager_effectiveness = []
    
    for m_id, m_user in managers.items():
        reports = [u.id for u in users if u.manager_id == m_id]
        if not reports:
            continue
            
        report_goals = [g.id for g in goals if g.owner_id in reports and g.is_locked]
        if not report_goals:
            manager_effectiveness.append({"name": m_user.name, "completionRate": 0.0})
            continue
            
        logged_count = db.query(models.CheckIn).filter(models.CheckIn.goal_id.in_(report_goals)).count()
        max_possible_logs = len(report_goals) * len(quarters)
        
        rate = (logged_count / max_possible_logs) * 100 if max_possible_logs > 0 else 0.0
        manager_effectiveness.append({
            "name": m_user.name,
            "completionRate": round(min(rate, 100.0), 1)
        })

    manager_effectiveness.sort(key=lambda x: x["completionRate"], reverse=True)

    return {
        "qoq_trends": qoq_trends,
        "goal_distribution": goal_distribution,
        "uom_breakdown": uom_breakdown,
        "manager_effectiveness": manager_effectiveness
    }
