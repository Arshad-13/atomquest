import pytest
from models import User, RoleEnum, Goal
from auth.security import get_password_hash
from fastapi.testclient import TestClient

def create_test_user(db, email, role=RoleEnum.EMPLOYEE):
    user = User(
        id=email.split("@")[0] + "_id",
        name="Test User",
        email=email,
        role=role,
        hashed_password=get_password_hash("SecureP@ss123")
    )
    db.add(user)
    db.commit()
    return user

def get_auth_headers(client, username, password):
    res = client.post("/auth/login", data={"username": username, "password": password})
    assert res.status_code == 200
    # Cookie is set, so we don't need token headers if client handles cookies,
    # but the test client preserves cookies automatically!
    return res.cookies

def test_password_complexity():
    from schemas import UserCreate
    # Valid
    UserCreate(name="a", email="a@a.com", password="Password123!", role=RoleEnum.EMPLOYEE)
    
    # Invalid length
    with pytest.raises(ValueError) as exc:
        UserCreate(name="a", email="a@a.com", password="P1!", role=RoleEnum.EMPLOYEE)
    assert "at least 8 characters" in str(exc.value)

    # Invalid uppercase
    with pytest.raises(ValueError) as exc:
        UserCreate(name="a", email="a@a.com", password="password123!", role=RoleEnum.EMPLOYEE)
    assert "uppercase letter" in str(exc.value)

    # Invalid number
    with pytest.raises(ValueError) as exc:
        UserCreate(name="a", email="a@a.com", password="Password!", role=RoleEnum.EMPLOYEE)
    assert "number" in str(exc.value)

    # Invalid special
    with pytest.raises(ValueError) as exc:
        UserCreate(name="a", email="a@a.com", password="Password123", role=RoleEnum.EMPLOYEE)
    assert "special character" in str(exc.value)


def test_max_eight_goals(client, db):
    user = create_test_user(db, "emp@test.com")
    cookies = get_auth_headers(client, "emp@test.com", "SecureP@ss123")
    
    # Create 8 goals of 10% weightage
    for i in range(8):
        res = client.post("/goals", json={
            "owner_id": user.id,
            "thrust_area": "Growth",
            "title": f"Goal {i}",
            "description": "Desc",
            "uom": "min",
            "target": 100,
            "weightage": 10
        }, cookies=cookies)
        assert res.status_code == 201

    # Adding 9th goal should fail
    res = client.post("/goals", json={
        "owner_id": user.id,
        "thrust_area": "Growth",
        "title": "Goal 9",
        "description": "Desc",
        "uom": "min",
        "target": 100,
        "weightage": 10
    }, cookies=cookies)
    assert res.status_code == 400
    assert "Maximum of 8 goals" in res.json()["detail"]


def test_total_weightage_limit(client, db):
    user = create_test_user(db, "emp2@test.com")
    cookies = get_auth_headers(client, "emp2@test.com", "SecureP@ss123")

    # Create first goal with 60%
    res = client.post("/goals", json={
        "owner_id": user.id,
        "thrust_area": "Growth",
        "title": "Goal 1",
        "description": "Desc",
        "uom": "min",
        "target": 100,
        "weightage": 60
    }, cookies=cookies)
    assert res.status_code == 201

    # Create second goal with 50% (exceeds 100% total)
    res = client.post("/goals", json={
        "owner_id": user.id,
        "thrust_area": "Growth",
        "title": "Goal 2",
        "description": "Desc",
        "uom": "min",
        "target": 100,
        "weightage": 50
    }, cookies=cookies)
    assert res.status_code == 400
    assert "exceeds the 100% weightage limit" in res.json()["detail"]


def test_min_weightage_per_goal(client, db):
    user = create_test_user(db, "emp3@test.com")
    cookies = get_auth_headers(client, "emp3@test.com", "SecureP@ss123")

    # Pydantic schema validation for min 10%
    res = client.post("/goals", json={
        "owner_id": user.id,
        "thrust_area": "Growth",
        "title": "Goal 1",
        "description": "Desc",
        "uom": "min",
        "target": 100,
        "weightage": 5
    }, cookies=cookies)
    assert res.status_code == 422
    assert "greater than or equal to 10" in res.json()["detail"]


def test_rate_limiting_login(client, db):
    create_test_user(db, "rate@test.com")
    
    # Attempt login 12 times (limiter is 10/minute)
    responses = []
    for _ in range(12):
        res = client.post("/auth/login", data={"username": "rate@test.com", "password": "WrongPassword"})
        responses.append(res.status_code)

    assert 429 in responses
