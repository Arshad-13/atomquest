import uuid
import sys
import os
from datetime import datetime, timedelta, timezone

# Add the backend directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal, engine
from models import (
    Base, User, RoleEnum, Goal, UoMEnum, StatusEnum, QuarterEnum,
    CycleWindow, ApprovalRequest, SharedGoalLink, CheckIn, EscalationRule
)

def wipe_and_recreate_db():
    print("🧹 Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("🛠️ Recreating all tables...")
    Base.metadata.create_all(bind=engine)

def seed_data():
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        
        # 1. CYCLE WINDOWS (Q1 is active)
        print("📅 Seeding Cycle Windows...")
        cycles = [
            CycleWindow(period_name="GOAL_SETTING", open_date=now - timedelta(days=90), close_date=now - timedelta(days=60), is_active=False),
            CycleWindow(period_name="Q1", open_date=now - timedelta(days=45), close_date=now + timedelta(days=15), is_active=True),
            CycleWindow(period_name="Q2", open_date=now + timedelta(days=20), close_date=now + timedelta(days=80), is_active=False),
            CycleWindow(period_name="Q3", open_date=now + timedelta(days=85), close_date=now + timedelta(days=145), is_active=False),
            CycleWindow(period_name="Q4", open_date=now + timedelta(days=150), close_date=now + timedelta(days=210), is_active=False)
        ]
        db.add_all(cycles)
        db.commit()

        # 2. ESCALATION RULES
        print("🚨 Seeding Escalation Rules...")
        rules = [
            EscalationRule(trigger_event="GOAL_NOT_SUBMITTED", days_threshold=7, is_active=True),
            EscalationRule(trigger_event="GOAL_NOT_APPROVED", days_threshold=14, is_active=True),
            EscalationRule(trigger_event="CHECKIN_MISSED", days_threshold=7, is_active=True),
        ]
        db.add_all(rules)
        db.commit()

        # 3. USERS (1 Admin, 2 Managers, 6 Employees)
        print("👥 Seeding Users...")
        from auth.security import get_password_hash
        pwd_hash = get_password_hash("test1234")
        
        admin = User(id=str(uuid.uuid4()), name="System Administrator", email="admin@example.com", role=RoleEnum.ADMIN, hashed_password=pwd_hash)
        db.add(admin)

        mgr1 = User(id=str(uuid.uuid4()), name="Alice (Manager A)", email="manager1@example.com", role=RoleEnum.MANAGER, hashed_password=pwd_hash)
        mgr2 = User(id=str(uuid.uuid4()), name="Bob (Manager B)", email="manager2@example.com", role=RoleEnum.MANAGER, hashed_password=pwd_hash)
        db.add_all([mgr1, mgr2])
        db.commit()

        employees = []
        for i in range(1, 4):
            employees.append(User(id=str(uuid.uuid4()), name=f"Employee A{i}", email=f"emp_a{i}@example.com", role=RoleEnum.EMPLOYEE, manager_id=mgr1.id, hashed_password=pwd_hash))
        for i in range(1, 4):
            employees.append(User(id=str(uuid.uuid4()), name=f"Employee B{i}", email=f"emp_b{i}@example.com", role=RoleEnum.EMPLOYEE, manager_id=mgr2.id, hashed_password=pwd_hash))
        
        db.add_all(employees)
        db.commit()

        # Add a convenience manager/employee just to match old hardcoded frontend credentials
        demo_manager = User(id=str(uuid.uuid4()), name="Demo Manager", email="manager@example.com", role=RoleEnum.MANAGER, hashed_password=pwd_hash)
        db.add(demo_manager)
        db.commit()
        demo_emp = User(id=str(uuid.uuid4()), name="Demo Employee", email="employee@example.com", role=RoleEnum.EMPLOYEE, manager_id=demo_manager.id, hashed_password=pwd_hash)
        db.add(demo_emp)
        db.commit()
        employees.append(demo_emp) # Include in goal generation

        # 4. GOALS & CHECK-INS for Employees
        print("🎯 Seeding Goals and Check-ins...")
        
        # Thrust areas
        thrusts = ["Financial Excellence", "Operational Efficiency", "Customer Success", "Innovation & Growth"]
        
        for emp in employees:
            g1 = Goal(owner_id=emp.id, thrust_area=thrusts[0], title="Reduce processing time", uom=UoMEnum.NUMERIC_MIN, target=15, weightage=30, status="approved", is_locked=True)
            g2 = Goal(owner_id=emp.id, thrust_area=thrusts[1], title="Increase unit tests coverage", uom=UoMEnum.NUMERIC_MAX, target=95, weightage=30, status="approved", is_locked=True)
            g3 = Goal(owner_id=emp.id, thrust_area=thrusts[2], title="Client Satisfaction Score", uom=UoMEnum.NUMERIC_MAX, target=4.8, weightage=40, status="approved", is_locked=True)
            
            # For Employee A1 ONLY, make the last goal 'returned' to demo the rework flow
            if emp.email == "emp_a1@example.com":
                g3.status = "draft"
                g3.is_locked = False
                db.add_all([g1, g2, g3])
                db.commit()
                # Create Approval Requests for the returned goal history
                db.add(ApprovalRequest(goal_id=g3.id, submitted_by=emp.id, reviewed_by=mgr1.id, action="RETURNED", comment="Please rethink the target for client satisfaction, 4.8 is a bit low for this tier. Aim for 4.9.", actioned_at=now))
            else:
                db.add_all([g1, g2, g3])
                db.commit()

            # Add Check-ins for locked/approved goals
            if g1.is_locked:
                db.add(CheckIn(goal_id=g1.id, quarter=QuarterEnum.Q1, actual_achievement=16.5, status=StatusEnum.ON_TRACK, manager_comment="Good start, tracking closely."))
            if g2.is_locked:
                db.add(CheckIn(goal_id=g2.id, quarter=QuarterEnum.Q1, actual_achievement=85, status=StatusEnum.ON_TRACK))
            if g3.is_locked:
                db.add(CheckIn(goal_id=g3.id, quarter=QuarterEnum.Q1, actual_achievement=4.5, status=StatusEnum.ON_TRACK))
                
            db.commit()

        # 5. SHARED GOALS (Push a shared goal from Manager 1 to Team A)
        print("🤝 Seeding Shared Goals...")
        team_a = [e for e in employees if e.manager_id == mgr1.id]
        if team_a:
            base_goal = Goal(owner_id=mgr1.id, thrust_area="Innovation & Growth", title="Release Q1 Feature X", uom=UoMEnum.TIMELINE, target=1.0, weightage=20, status="approved", is_locked=True)
            db.add(base_goal)
            db.commit()
            
            # Push to Team A
            primary = team_a[0]
            for emp in team_a:
                emp_goal = Goal(owner_id=emp.id, thrust_area="Innovation & Growth", title="Release Q1 Feature X (Shared)", uom=UoMEnum.TIMELINE, target=1.0, weightage=0, status="draft", is_locked=False)
                db.add(emp_goal)
                db.flush()
                # Link
                link = SharedGoalLink(base_goal_id=base_goal.id, primary_owner_id=primary.id, recipient_id=emp.id, custom_weightage=0)
                db.add(link)
            db.commit()

        print("✅ Database cleanly wiped and seeded successfully!")
        print("Login Options:")
        print("  - Admin: admin@example.com")
        print("  - Manager: manager@example.com (or manager1@, manager2@)")
        print("  - Employee: employee@example.com (or emp_a1@, emp_b1@, etc.)")
        print("Password for all: test1234")

    except Exception as e:
        print(f"❌ Error seeding users: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    wipe_and_recreate_db()
    seed_data()
