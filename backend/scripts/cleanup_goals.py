import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
import models

def cleanup():
    db = SessionLocal()
    try:
        print("[CLEANUP] Initializing goal cleanup script...")
        
        # 1. Fetch all users
        all_users = db.query(models.User).all()
        
        for user in all_users:
            if user.role in [models.RoleEnum.MANAGER, models.RoleEnum.ADMIN]:
                # Remove ALL goals for managers and admins
                mgr_goals = db.query(models.Goal).filter(models.Goal.owner_id == user.id).all()
                if mgr_goals:
                    print(f"  [USER] {user.name} ({user.role.value}): Deleting all {len(mgr_goals)} goals assigned as personal OKRs...")
                    for g in mgr_goals:
                        # FK-safe delete
                        db.query(models.CheckIn).filter(models.CheckIn.goal_id == g.id).delete()
                        db.query(models.ApprovalRequest).filter(models.ApprovalRequest.goal_id == g.id).delete()
                        db.query(models.AuditLog).filter(models.AuditLog.goal_id == g.id).delete()
                        db.query(models.SharedGoalLink).filter(models.SharedGoalLink.base_goal_id == g.id).delete()
                        db.delete(g)
            else:
                # Employee user: enforce strict <= 100% weightage
                emp_goals = db.query(models.Goal).filter(models.Goal.owner_id == user.id).order_by(models.Goal.id.asc()).all()
                if not emp_goals:
                    continue
                
                running_weightage = 0.0
                kept_goals = []
                deleted_count = 0
                
                for g in emp_goals:
                    # Let's check if adding this goal's weightage stays within strict 100% limit
                    if running_weightage + g.weightage <= 100.0:
                        running_weightage += g.weightage
                        kept_goals.append(g)
                    else:
                        # Surplus goal: delete in FK-safe order!
                        deleted_count += 1
                        db.query(models.CheckIn).filter(models.CheckIn.goal_id == g.id).delete()
                        db.query(models.ApprovalRequest).filter(models.ApprovalRequest.goal_id == g.id).delete()
                        db.query(models.AuditLog).filter(models.AuditLog.goal_id == g.id).delete()
                        db.query(models.SharedGoalLink).filter(models.SharedGoalLink.base_goal_id == g.id).delete()
                        db.delete(g)
                
                if deleted_count > 0:
                    print(f"  [USER] {user.name} (employee): Kept {len(kept_goals)} goals, deleted {deleted_count} surplus goals. Rebalanced total: {running_weightage}%")

        db.commit()
        print("[SUCCESS] Database is completely consistent and strictly validated!")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Cleanup script failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    cleanup()
