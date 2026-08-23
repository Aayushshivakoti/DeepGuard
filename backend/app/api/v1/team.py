"""
app/api/v1/team.py — Team Workspaces Endpoints (DB-backed CRUD)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.team import Team, TeamMember, Organization
from app.db.models.user import User
from app.db.session import get_db
from app.api.v1.auth import require_current_user

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/teams", tags=["Team Workspaces"])


# ─── Pydantic Schemas ─────────────────────────────────────────────────────────

class TeamMemberSchema(BaseModel):
    user_id: str
    email: str
    role: str


class TeamSchema(BaseModel):
    id: str
    name: str
    role: str
    member_count: int
    created_at: datetime


class CreateTeamRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    org_name: Optional[str] = Field(None, description="Optional organization name. If empty, auto-generates organization.")


class AddMemberRequest(BaseModel):
    email: str
    role: str = "MEMBER"  # OWNER | ADMIN | MEMBER


# ─── GET /teams — List all teams current user is member of ────────────────────

@router.get("", response_model=List[TeamSchema])
async def list_user_teams(
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all teams that the current authenticated user belongs to."""
    query = (
        select(Team, TeamMember.role)
        .join(TeamMember, Team.id == TeamMember.team_id)
        .where(TeamMember.user_id == current_user.id)
    )
    result = await db.execute(query)
    teams_with_roles = result.all()

    teams_response = []
    for team, role in teams_with_roles:
        # Get member count for each team
        count_query = select(func.count(TeamMember.id)).where(TeamMember.team_id == team.id)
        count_res = await db.execute(count_query)
        member_count = count_res.scalar_one() or 0

        teams_response.append(
            TeamSchema(
                id=str(team.id),
                name=team.name,
                role=role,
                member_count=member_count,
                created_at=team.created_at,
            )
        )

    return teams_response


# ─── POST /teams — Create a new team workspace ───────────────────────────────

@router.post("", response_model=TeamSchema, status_code=status.HTTP_201_CREATED)
async def create_team(
    body: CreateTeamRequest,
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new team workspace.
    Automatically creates a parent Organization if one is not associated.
    Sets the creator as the 'OWNER'.
    """
    # 1. Create/Find Organization
    org_name = body.org_name or f"{body.name} Org"
    org_slug = org_name.lower().replace(" ", "-") + "-" + uuid.uuid4().hex[:6]

    org = Organization(
        name=org_name,
        slug=org_slug,
    )
    db.add(org)
    await db.commit()
    await db.refresh(org)

    # 2. Create Team
    team = Team(
        org_id=org.id,
        name=body.name,
    )
    db.add(team)
    await db.commit()
    await db.refresh(team)

    # 3. Add creator as OWNER member
    member = TeamMember(
        team_id=team.id,
        user_id=current_user.id,
        role="OWNER",
    )
    db.add(member)
    await db.commit()

    log.info("team.created", team_id=str(team.id), org_id=str(org.id), creator=current_user.email)

    return TeamSchema(
        id=str(team.id),
        name=team.name,
        role="OWNER",
        member_count=1,
        created_at=team.created_at,
    )


# ─── GET /teams/{team_id}/members — List team members ────────────────────────

@router.get("/{team_id}/members", response_model=List[TeamMemberSchema])
async def list_team_members(
    team_id: str,
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all members belonging to a team workspace."""
    team_uuid = uuid.UUID(team_id)

    # Verify user is member of the team
    member_check = await db.execute(
        select(TeamMember).where(TeamMember.team_id == team_uuid, TeamMember.user_id == current_user.id)
    )
    if not member_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this team workspace.",
        )

    # Fetch members with email
    query = (
        select(TeamMember.user_id, User.email, TeamMember.role)
        .join(User, TeamMember.user_id == User.id)
        .where(TeamMember.team_id == team_uuid)
    )
    result = await db.execute(query)
    members = result.all()

    return [
        TeamMemberSchema(
            user_id=str(m[0]),
            email=m[1],
            role=m[2],
        )
        for m in members
    ]


# ─── POST /teams/{team_id}/members — Add member to team ─────────────────────

@router.post("/{team_id}/members", status_code=status.HTTP_201_CREATED)
async def add_team_member(
    team_id: str,
    body: AddMemberRequest,
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a new user to the team workspace by email (requires admin/owner rights)."""
    team_uuid = uuid.UUID(team_id)

    # Verify current user is OWNER or ADMIN of the team
    current_member = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_uuid,
            TeamMember.user_id == current_user.id,
            TeamMember.role.in_(["OWNER", "ADMIN"]),
        )
    )
    if not current_member.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required to add team members.",
        )

    # Find the target user by email
    target_user_res = await db.execute(select(User).where(User.email == body.email))
    target_user = target_user_res.scalar_one_or_none()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with email {body.email} not found.",
        )

    # Check if target is already a member
    existing_member = await db.execute(
        select(TeamMember).where(TeamMember.team_id == team_uuid, TeamMember.user_id == target_user.id)
    )
    if existing_member.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This user is already a member of the team workspace.",
        )

    # Create membership
    new_member = TeamMember(
        team_id=team_uuid,
        user_id=target_user.id,
        role=body.role.upper() if body.role.upper() in ("OWNER", "ADMIN", "MEMBER") else "MEMBER",
    )
    db.add(new_member)
    await db.commit()

    log.info("team.member_added", team_id=team_id, added_user=body.email, added_by=current_user.email)

    return {
        "status": "ADDED",
        "email": body.email,
        "role": new_member.role,
        "message": f"Successfully added {body.email} to the team workspace.",
    }


# ─── DELETE /teams/{team_id}/members/{user_id} — Remove member ───────────────

@router.delete("/{team_id}/members/{user_id}", status_code=status.HTTP_200_OK)
async def remove_team_member(
    team_id: str,
    user_id: str,
    current_user: User = Depends(require_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member from the team workspace."""
    team_uuid = uuid.UUID(team_id)
    target_uuid = uuid.UUID(user_id)

    # Verify current user is OWNER or ADMIN (or is leaving the team themselves)
    is_self = current_user.id == target_uuid
    
    if not is_self:
        current_member = await db.execute(
            select(TeamMember).where(
                TeamMember.team_id == team_uuid,
                TeamMember.user_id == current_user.id,
                TeamMember.role.in_(["OWNER", "ADMIN"]),
            )
        )
        if not current_member.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrative privileges required to remove team members.",
            )

    # Perform removal
    delete_stmt = delete(TeamMember).where(TeamMember.team_id == team_uuid, TeamMember.user_id == target_uuid)
    await db.execute(delete_stmt)
    await db.commit()

    log.info("team.member_removed", team_id=team_id, removed_user_id=user_id, removed_by=current_user.email)

    return {
        "status": "REMOVED",
        "message": "User removed from the team workspace successfully." if not is_self else "You have left the team workspace."
    }
