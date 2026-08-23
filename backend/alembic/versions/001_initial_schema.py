"""
Alembic Migration 001 — Complete Initial Schema

Creates all core tables including new auth tables and
soft-delete columns for GDPR compliance.

Revision ID: 001_initial_schema
Create Date: 2025-01-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    # ── Users ────────────────────────────────────────────────────────────────
    if 'users' not in existing_tables:
        op.create_table(
            'users',
            sa.Column('id', sa.Uuid(as_uuid=True), primary_key=True),
            sa.Column('email', sa.String(255), nullable=False, unique=True, index=True),
            sa.Column('hashed_password', sa.String(255), nullable=False),
            sa.Column('role', sa.String(50), nullable=False, server_default='USER'),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
            sa.Column('oauth_provider', sa.String(50), nullable=True,
                      comment='google, github, microsoft, or null for email/password'),
            sa.Column('tier', sa.String(20), nullable=False, server_default='FREE',
                      comment='FREE, PRO, ENTERPRISE'),
            sa.Column('password_changed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
            sa.Column('last_login', sa.DateTime(timezone=True), nullable=True),
            sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True,
                      comment='Soft-delete for GDPR. Non-null = deleted.'),
        )

    # ── Refresh Tokens ───────────────────────────────────────────────────────
    if 'refresh_tokens' not in existing_tables:
        op.create_table(
            'refresh_tokens',
            sa.Column('id', sa.Uuid(as_uuid=True), primary_key=True),
            sa.Column('user_id', sa.Uuid(as_uuid=True),
                      sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('token_hash', sa.String(64), nullable=False, unique=True, index=True),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('revoked', sa.Boolean(), nullable=False, server_default=sa.text('false')),
            sa.Column('device_info', sa.Text(), nullable=True),
            sa.Column('ip_address', sa.String(50), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
        )

    # ── WebAuthn Credentials ─────────────────────────────────────────────────
    if 'webauthn_credentials' not in existing_tables:
        op.create_table(
            'webauthn_credentials',
            sa.Column('id', sa.Uuid(as_uuid=True), primary_key=True),
            sa.Column('user_id', sa.Uuid(as_uuid=True),
                      sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('credential_id', sa.Text(), nullable=False, unique=True, index=True),
            sa.Column('public_key', sa.Text(), nullable=False),
            sa.Column('sign_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('device_name', sa.String(255), nullable=True),
            sa.Column('aaguid', sa.String(36), nullable=True),
            sa.Column('transports', sa.String(255), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
            sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        )

    # ── Scan Results ─────────────────────────────────────────────────────────
    if 'scan_results' not in existing_tables:
        op.create_table(
            'scan_results',
            sa.Column('id', sa.Uuid(as_uuid=True), primary_key=True, index=True),
            sa.Column('filename', sa.String(512), nullable=True),
            sa.Column('url', sa.Text(), nullable=True),
            sa.Column('media_type', sa.String(50), nullable=False),
            sa.Column('verdict', sa.String(50), nullable=False),
            sa.Column('confidence', sa.Float(), nullable=False, server_default='0.0'),
            sa.Column('forensic_flags', sa.JSON(), nullable=True),
            sa.Column('engine_metadata', sa.JSON(), nullable=True),
            sa.Column('heatmap_b64', sa.Text(), nullable=True),
            sa.Column('processing_time_ms', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('model_version', sa.String(50), nullable=False, server_default='DeepGuard-v3.1'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now(), index=True),
            sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        )

    # ── Scan Records (user-linked) ───────────────────────────────────────────
    if 'scan_records' not in existing_tables:
        op.create_table(
            'scan_records',
            sa.Column('id', sa.Uuid(as_uuid=True), primary_key=True, index=True),
            sa.Column('user_id', sa.Uuid(as_uuid=True),
                      sa.ForeignKey('users.id'), nullable=True, index=True),
            sa.Column('filename', sa.String(512), nullable=True),
            sa.Column('file_hash', sa.String(64), nullable=True, index=True,
                      comment='SHA-256 hash for scan deduplication'),
            sa.Column('media_type', sa.String(50), nullable=False),
            sa.Column('verdict', sa.String(50), nullable=False),
            sa.Column('confidence_score', sa.Float(), nullable=False, server_default='0.0'),
            sa.Column('details', sa.JSON(), nullable=True),
            sa.Column('heatmap_path', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now(), index=True),
            sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        )

    # ── Audit Logs ───────────────────────────────────────────────────────────
    if 'audit_logs' not in existing_tables:
        op.create_table(
            'audit_logs',
            sa.Column('id', sa.Uuid(as_uuid=True), primary_key=True, index=True),
            sa.Column('action', sa.String(100), nullable=False, index=True),
            sa.Column('entity_type', sa.String(50), nullable=True),
            sa.Column('entity_id', sa.String(100), nullable=True),
            sa.Column('metadata', sa.JSON(), nullable=True),
            sa.Column('ip_address', sa.String(50), nullable=True),
            sa.Column('user_agent', sa.Text(), nullable=True),
            sa.Column('user_id', sa.String(100), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now(), index=True),
        )

    # ── Organizations ────────────────────────────────────────────────────────
    if 'organizations' not in existing_tables:
        op.create_table(
            'organizations',
            sa.Column('id', sa.Uuid(as_uuid=True), primary_key=True),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('slug', sa.String(255), nullable=False, unique=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    # ── Teams ────────────────────────────────────────────────────────────────
    if 'teams' not in existing_tables:
        op.create_table(
            'teams',
            sa.Column('id', sa.Uuid(as_uuid=True), primary_key=True),
            sa.Column('org_id', sa.Uuid(as_uuid=True),
                      sa.ForeignKey('organizations.id'), nullable=False),
            sa.Column('name', sa.String(255), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    # ── Team Members ─────────────────────────────────────────────────────────
    if 'team_members' not in existing_tables:
        op.create_table(
            'team_members',
            sa.Column('id', sa.Uuid(as_uuid=True), primary_key=True),
            sa.Column('team_id', sa.Uuid(as_uuid=True),
                      sa.ForeignKey('teams.id'), nullable=False),
            sa.Column('user_id', sa.Uuid(as_uuid=True),
                      sa.ForeignKey('users.id'), nullable=False),
            sa.Column('role', sa.String(50), server_default='MEMBER'),
        )

    # ── Scheduled Monitors ───────────────────────────────────────────────────
    if 'scheduled_monitors' not in existing_tables:
        op.create_table(
            'scheduled_monitors',
            sa.Column('id', sa.Uuid(as_uuid=True), primary_key=True, index=True),
            sa.Column('user_id', sa.Uuid(as_uuid=True), nullable=True, index=True),
            sa.Column('url_or_domain', sa.String(500), nullable=False),
            sa.Column('frequency', sa.String(50), server_default='DAILY'),
            sa.Column('target_email', sa.String(255), nullable=True),
            sa.Column('webhook_url', sa.String(500), nullable=True),
            sa.Column('status', sa.String(50), server_default='ACTIVE'),
            sa.Column('last_confidence', sa.Float(), server_default='0.0'),
            sa.Column('last_verdict', sa.String(50), server_default='AUTHENTIC'),
            sa.Column('last_run', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
        )


def downgrade() -> None:
    op.drop_table('scheduled_monitors')
    op.drop_table('team_members')
    op.drop_table('teams')
    op.drop_table('organizations')
    op.drop_table('audit_logs')
    op.drop_table('scan_records')
    op.drop_table('scan_results')
    op.drop_table('webauthn_credentials')
    op.drop_table('refresh_tokens')
    op.drop_table('users')
