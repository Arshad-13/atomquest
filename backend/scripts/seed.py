"""
Phase 9.4 -- Full Org Seed Script
Creates a realistic demo dataset:
  - 1 Admin (HR)
  - 2 Managers (Engineering + Product)
  - 6 Employees (3 per manager)
  - 5 Goals per employee with weightages summing to 100%
  - Active Q1 cycle window
  - Q1 check-ins submitted for all employees
  - 1 employee with a returned goal (to demo rework flow)
  - 2 shared goals pushed from a manager

Usage:
  python seed.py           # Idempotent: skips already-existing records
  python seed.py --clean   # WARNING: Wipes ALL data first, then seeds fresh
"""
import sys
import os
import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models import (
    User, Goal, CheckIn, CycleWindow, SharedGoalLink,
    ApprovalRequest, AuditLog, EscalationRule, EscalationLog,
    RoleEnum, UoMEnum, StatusEnum, QuarterEnum
)


def wipe_db():
    """
    Deletes all rows from every table in FK-safe order (children before parents).
    Call this before seeding to guarantee a clean slate.
    """
    db = SessionLocal()
    try:
        print("[WIPE] Wiping existing data...")
        db.query(EscalationLog).delete()
        db.query(EscalationRule).delete()
        db.query(AuditLog).delete()
        db.query(CheckIn).delete()
        db.query(ApprovalRequest).delete()
        db.query(SharedGoalLink).delete()
        db.query(Goal).delete()
        db.query(CycleWindow).delete()
        db.query(User).delete()
        db.commit()
        print("   [OK] All tables cleared.")
    except Exception as e:
        db.rollback()
        print(f"   [ERR] Wipe failed: {e}")
        raise
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────
# Static IDs (so script stays idempotent across runs)
# ─────────────────────────────────────────────────────────────
ADMIN_ID = "usr-admin-001"
MGR1_ID  = "usr-mgr-001"
MGR2_ID  = "usr-mgr-002"
EMP_IDS  = [f"usr-emp-00{i}" for i in range(1, 7)]  # emp001-006

GOAL_TEMPLATES = [
    # (thrust_area, title, uom, target, weightage)
    ("Customer Excellence",     "Improve NPS Score",           UoMEnum.NUMERIC_MIN, 75.0,  25.0),
    ("Operational Efficiency",  "Reduce Deployment Time",      UoMEnum.NUMERIC_MAX, 30.0,  20.0),
    ("Innovation & Technology", "Launch Feature Flag System",  UoMEnum.ZERO,         0.0,  20.0),
    ("People & Culture",        "Complete L&D Certifications", UoMEnum.NUMERIC_MIN,  3.0,  15.0),
    ("Revenue Growth",          "Increase Upsell Conversion",  UoMEnum.NUMERIC_MIN, 15.0,  20.0),
]

GOAL_TEMPLATES_B = [
    ("Customer Excellence",     "Reduce Support Ticket Volume",  UoMEnum.NUMERIC_MAX, 200.0, 25.0),
    ("Operational Efficiency",  "Improve CI/CD Pipeline Uptime", UoMEnum.NUMERIC_MIN,  99.5, 25.0),
    ("Innovation & Technology", "Ship Mobile App v2",            UoMEnum.ZERO,          0.0, 20.0),
    ("People & Culture",        "Conduct Quarterly 1:1s",        UoMEnum.NUMERIC_MIN,  12.0, 15.0),
    ("Revenue Growth",          "Onboard Enterprise Clients",    UoMEnum.NUMERIC_MIN,   3.0, 15.0),
]


def get_or_create(db, Model, filter_kwargs, create_kwargs):
    """Fetch existing or create a new record."""
    obj = db.query(Model).filter_by(**filter_kwargs).first()
    if not obj:
        obj = Model(**{**filter_kwargs, **create_kwargs})
        db.add(obj)
        db.flush()
    return obj


def seed():
    db = SessionLocal()
    try:
        print("[SEED] Seeding AtomQuest demo database...")

        # -- 1. Users ------------------------------------------------
        get_or_create(db, User,
            {"id": ADMIN_ID},
            {"name": "Priya Sharma (HR Admin)", "email": "admin@atomquest.com", "role": RoleEnum.ADMIN}
        )
        mgr1 = get_or_create(db, User,
            {"id": MGR1_ID},
            {"name": "Arjun Mehta", "email": "manager@atomquest.com", "role": RoleEnum.MANAGER}
        )
        mgr2 = get_or_create(db, User,
            {"id": MGR2_ID},
            {"name": "Sneha Rao", "email": "manager2@atomquest.com", "role": RoleEnum.MANAGER}
        )

        emp_data = [
            (EMP_IDS[0], "Ravi Kumar",  "employee@atomquest.com",  MGR1_ID),
            (EMP_IDS[1], "Anita Desai", "employee2@atomquest.com", MGR1_ID),
            (EMP_IDS[2], "Karan Singh", "employee3@atomquest.com", MGR1_ID),
            (EMP_IDS[3], "Priya Nair",  "employee4@atomquest.com", MGR2_ID),
            (EMP_IDS[4], "Rohit Verma", "employee5@atomquest.com", MGR2_ID),
            (EMP_IDS[5], "Aisha Patel", "employee6@atomquest.com", MGR2_ID),
        ]

        employees = []
        for eid, name, email, mgr_id in emp_data:
            emp = get_or_create(db, User,
                {"id": eid},
                {"name": name, "email": email, "role": RoleEnum.EMPLOYEE, "manager_id": mgr_id}
            )
            employees.append(emp)

        db.commit()
        print("  [OK] Users: 1 admin, 2 managers, 6 employees")

        # -- 2. Active Cycle Window (Q1) -----------------------------
        active_cycle = db.query(CycleWindow).filter(CycleWindow.is_active == True).first()
        if not active_cycle:
            now = datetime.datetime.now(datetime.timezone.utc)
            active_cycle = CycleWindow(
                period_name="Q1",
                open_date=now - datetime.timedelta(days=30),
                close_date=now + datetime.timedelta(days=60),
                is_active=True
            )
            db.add(active_cycle)
            db.commit()
            print("  [OK] Active Q1 cycle window created")
        else:
            print("  [SKIP] Cycle window already exists")

        # -- 3. Goals + Check-ins ------------------------------------
        for i, emp in enumerate(employees):
            existing = db.query(Goal).filter(Goal.owner_id == emp.id).count()
            if existing > 0:
                print(f"  [SKIP] Goals for {emp.name} already exist")
                continue

            templates = GOAL_TEMPLATES if i < 3 else GOAL_TEMPLATES_B
            emp_goals = []

            for ta, title, uom, target, weightage in templates:
                goal = Goal(
                    owner_id=emp.id,
                    thrust_area=ta,
                    title=title,
                    description=f"Strategic objective for {emp.name}: {title}",
                    uom=uom,
                    target=target,
                    weightage=weightage,
                    status="approved",
                    is_locked=True
                )
                db.add(goal)
                db.flush()
                emp_goals.append(goal)

                db.add(ApprovalRequest(
                    goal_id=goal.id,
                    submitted_by=emp.id,
                    reviewed_by=mgr1.id if emp.manager_id == MGR1_ID else mgr2.id,
                    action="APPROVED"
                ))

                actual = target * 0.85 if uom == UoMEnum.NUMERIC_MIN else target * 1.1
                if uom == UoMEnum.ZERO:
                    actual = 0.0
                db.add(CheckIn(
                    goal_id=goal.id,
                    quarter=QuarterEnum.Q1,
                    actual_achievement=actual,
                    status=StatusEnum.ON_TRACK
                ))

            db.commit()
            print(f"  [OK] {len(emp_goals)} goals + Q1 check-ins for {emp.name}")

        # -- 4. Returned Goal Demo (Ravi Kumar) ----------------------
        emp1 = employees[0]
        if not db.query(Goal).filter(Goal.owner_id == emp1.id, Goal.status == "returned").first():
            returned_goal = Goal(
                owner_id=emp1.id,
                thrust_area="Innovation & Technology",
                title="Implement AI-Powered Code Review",
                description="Integrate LLM-based PR review tooling into CI pipeline.",
                uom=UoMEnum.ZERO,
                target=0.0,
                weightage=0.0,  # 0% -- returned goals don't count toward budget
                status="returned",
                is_locked=False
            )
            db.add(returned_goal)
            db.flush()
            db.add(ApprovalRequest(
                goal_id=returned_goal.id,
                submitted_by=emp1.id,
                reviewed_by=mgr1.id,
                action="RETURNED",
                comment="Please add more detail on the specific LLM model to be used and provide a cost estimate before resubmitting."
            ))
            db.commit()
            print(f"  [OK] Returned goal created for {emp1.name} (demo rework flow)")
        else:
            print(f"  [SKIP] Returned goal for {emp1.name} already exists")

        # -- 5. Shared Goals (Manager 1 -> Team) ---------------------
        if db.query(SharedGoalLink).count() == 0:
            shared_configs = [
                {
                    "title": "[SHARED] Q1 Engineering Reliability Target",
                    "thrust_area": "Operational Efficiency",
                    "uom": UoMEnum.NUMERIC_MIN,
                    "target": 99.9,
                    "weightage": 10.0,
                    "recipients": [EMP_IDS[0], EMP_IDS[1], EMP_IDS[2]]
                },
                {
                    "title": "[SHARED] Hackathon Demo Feature Delivery",
                    "thrust_area": "Innovation & Technology",
                    "uom": UoMEnum.ZERO,
                    "target": 0.0,
                    "weightage": 10.0,
                    "recipients": [EMP_IDS[0], EMP_IDS[2]]
                }
            ]

            for cfg in shared_configs:
                base_goal = Goal(
                    owner_id=MGR1_ID,
                    thrust_area=cfg["thrust_area"],
                    title=cfg["title"],
                    description="Team-wide shared objective.",
                    uom=cfg["uom"],
                    target=cfg["target"],
                    weightage=cfg["weightage"],
                    status="approved",
                    is_locked=True
                )
                db.add(base_goal)
                db.flush()

                for rid in cfg["recipients"]:
                    db.add(SharedGoalLink(
                        base_goal_id=base_goal.id,
                        primary_owner_id=EMP_IDS[0],
                        recipient_id=rid,
                        custom_weightage=cfg["weightage"]
                    ))

            db.commit()
            print("  [OK] 2 shared goals pushed to team")
        else:
            print("  [SKIP] Shared goals already exist")

        # -- 6. Escalation Rules -------------------------------------
        for event, threshold in [("GOAL_NOT_SUBMITTED", 7), ("GOAL_NOT_APPROVED", 14), ("CHECKIN_MISSED", 3)]:
            if not db.query(EscalationRule).filter(EscalationRule.trigger_event == event).first():
                db.add(EscalationRule(trigger_event=event, days_threshold=threshold, is_active=True))
        db.commit()
        print("  [OK] Escalation rules seeded")

        # -- 7. Audit Logs -------------------------------------------
        if db.query(AuditLog).count() == 0:
            for g in db.query(Goal).filter(Goal.status == "approved").limit(3).all():
                db.add(AuditLog(goal_id=g.id, changed_by=MGR1_ID, change_summary="Goal was APPROVED and LOCKED."))
            db.commit()
            print("  [OK] Sample audit log entries created")

        print("\n[DONE] Seed complete! Demo credentials:")
        print("   admin@atomquest.com     / test1234  (Admin/HR)")
        print("   manager@atomquest.com   / test1234  (Engineering Manager)")
        print("   manager2@atomquest.com  / test1234  (Product Manager)")
        print("   employee@atomquest.com  / test1234  (Employee -- has returned goal)")
        print("   employee2@atomquest.com / test1234  (Employee)")
        print("   employee3-6@atomquest.com / test1234")

    except Exception as e:
        db.rollback()
        print(f"\n[ERR] Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    clean = "--clean" in sys.argv
    if clean:
        print("[WARN] --clean flag detected. This will WIPE all existing data.")
        confirm = input("   Type 'yes' to confirm: ").strip().lower()
        if confirm != "yes":
            print("   Aborted.")
            sys.exit(0)
        wipe_db()
    seed()