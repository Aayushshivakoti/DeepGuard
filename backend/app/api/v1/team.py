"""
app/api/v1/team.py — Team Workspaces Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter(prefix="/teams", tags=["Team Workspaces"])

class TeamSchema(BaseModel):
    id: str
    name: str
    role: str
    member_count: int

@router.get("", response_model=List[TeamSchema])
async def list_user_teams():
    return [
        {"id": "team-01", "name": "Personal Workspace", "role": "OWNER", "member_count": 1},
        {"id": "team-02", "name": "Fraud Investigation Desk", "role": "ANALYST", "member_count": 5},
        {"id": "team-03", "name": "Editorial Verification Unit", "role": "MEMBER", "member_count": 12},
    ]

@router.post("", response_model=TeamSchema)
async def create_team(body: dict):
    return {
        "id": f"team-{body.get('name', 'new').lower().replace(' ', '-')}",
        "name": body.get("name", "New Team Workspace"),
        "role": "OWNER",
        "member_count": 1
    }
