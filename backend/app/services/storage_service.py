"""
app/services/storage_service.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
S3/MinIO Object Storage Abstraction Layer

Provides unified file upload/download/delete operations with:
  - S3-compatible cloud storage (AWS S3, MinIO, DigitalOcean Spaces)
  - Local filesystem fallback when S3 credentials are not configured
  - Pre-signed URL generation for secure file access
"""
from __future__ import annotations

import hashlib
import io
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional

import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)

# Local fallback storage directory
LOCAL_STORAGE_DIR = Path("uploads")


def _get_s3_client():
    """Create S3 client if credentials are configured."""
    s3_endpoint = getattr(settings, "S3_ENDPOINT", "")
    s3_access_key = getattr(settings, "S3_ACCESS_KEY", "")
    s3_secret_key = getattr(settings, "S3_SECRET_KEY", "")

    if not s3_access_key or not s3_secret_key:
        return None

    try:
        import boto3
        from botocore.config import Config

        client_kwargs = {
            "aws_access_key_id": s3_access_key,
            "aws_secret_access_key": s3_secret_key,
            "config": Config(
                signature_version="s3v4",
                retries={"max_attempts": 3, "mode": "adaptive"},
            ),
        }

        if s3_endpoint:
            client_kwargs["endpoint_url"] = s3_endpoint

        region = getattr(settings, "S3_REGION", "us-east-1")
        client_kwargs["region_name"] = region

        return boto3.client("s3", **client_kwargs)

    except ImportError:
        log.warning("storage.boto3_unavailable", fallback="local_filesystem")
        return None
    except Exception as e:
        log.error("storage.s3_client_failed", error=str(e))
        return None


async def upload_file(
    buffer: bytes,
    filename: str,
    content_type: str = "application/octet-stream",
    folder: str = "scans",
) -> Dict[str, Any]:
    """
    Upload a file to S3 or local storage.

    Returns dict with storage_key, storage_backend, file_hash, and size_bytes.
    """
    file_hash = hashlib.sha256(buffer).hexdigest()
    ext = os.path.splitext(filename)[1] or ".bin"
    storage_key = f"{folder}/{datetime.now(timezone.utc).strftime('%Y/%m/%d')}/{file_hash[:12]}_{uuid.uuid4().hex[:8]}{ext}"

    s3_client = _get_s3_client()
    bucket = getattr(settings, "S3_BUCKET", "deepguard-uploads")

    if s3_client:
        try:
            s3_client.put_object(
                Bucket=bucket,
                Key=storage_key,
                Body=buffer,
                ContentType=content_type,
                Metadata={
                    "original-filename": filename,
                    "sha256": file_hash,
                    "uploaded-at": datetime.now(timezone.utc).isoformat(),
                },
            )
            log.info("storage.s3_uploaded", key=storage_key, size=len(buffer))
            return {
                "storage_key": storage_key,
                "storage_backend": "s3",
                "bucket": bucket,
                "file_hash": file_hash,
                "size_bytes": len(buffer),
            }
        except Exception as e:
            log.error("storage.s3_upload_failed", error=str(e), fallback="local")

    # Local filesystem fallback
    local_path = LOCAL_STORAGE_DIR / storage_key
    local_path.parent.mkdir(parents=True, exist_ok=True)
    local_path.write_bytes(buffer)

    log.info("storage.local_uploaded", path=str(local_path), size=len(buffer))
    return {
        "storage_key": storage_key,
        "storage_backend": "local",
        "local_path": str(local_path),
        "file_hash": file_hash,
        "size_bytes": len(buffer),
    }


async def download_file(storage_key: str) -> Optional[bytes]:
    """Download a file from S3 or local storage."""
    s3_client = _get_s3_client()
    bucket = getattr(settings, "S3_BUCKET", "deepguard-uploads")

    if s3_client:
        try:
            response = s3_client.get_object(Bucket=bucket, Key=storage_key)
            data = response["Body"].read()
            log.debug("storage.s3_downloaded", key=storage_key)
            return data
        except Exception as e:
            log.warning("storage.s3_download_failed", key=storage_key, error=str(e))

    # Local fallback
    local_path = LOCAL_STORAGE_DIR / storage_key
    if local_path.exists():
        return local_path.read_bytes()

    log.warning("storage.file_not_found", key=storage_key)
    return None


async def delete_file(storage_key: str) -> bool:
    """Delete a file from S3 or local storage."""
    s3_client = _get_s3_client()
    bucket = getattr(settings, "S3_BUCKET", "deepguard-uploads")

    if s3_client:
        try:
            s3_client.delete_object(Bucket=bucket, Key=storage_key)
            log.info("storage.s3_deleted", key=storage_key)
            return True
        except Exception as e:
            log.warning("storage.s3_delete_failed", key=storage_key, error=str(e))

    # Local fallback
    local_path = LOCAL_STORAGE_DIR / storage_key
    if local_path.exists():
        local_path.unlink()
        log.info("storage.local_deleted", path=str(local_path))
        return True

    return False


async def generate_presigned_url(storage_key: str, expires_in: int = 3600) -> Optional[str]:
    """Generate a pre-signed URL for temporary file access (S3 only)."""
    s3_client = _get_s3_client()
    bucket = getattr(settings, "S3_BUCKET", "deepguard-uploads")

    if not s3_client:
        return None

    try:
        url = s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": storage_key},
            ExpiresIn=expires_in,
        )
        return url
    except Exception as e:
        log.warning("storage.presign_failed", key=storage_key, error=str(e))
        return None


async def check_duplicate(file_hash: str) -> Optional[Dict[str, Any]]:
    """
    Check if a file with this SHA-256 hash already exists in the database.
    Returns the existing scan record if found.
    """
    try:
        from app.db.session import AsyncSessionLocal
        from app.db.models.scan_record import ScanRecord
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(ScanRecord)
                .where(ScanRecord.file_hash == file_hash)
                .order_by(ScanRecord.created_at.desc())
                .limit(1)
            )
            record = result.scalar_one_or_none()

            if record:
                log.info("storage.duplicate_found", file_hash=file_hash[:12], record_id=str(record.id))
                return {
                    "is_duplicate": True,
                    "existing_record_id": str(record.id),
                    "existing_verdict": record.verdict,
                    "existing_confidence": record.confidence_score,
                    "scanned_at": record.created_at.isoformat() if record.created_at else None,
                }

        return {"is_duplicate": False}

    except Exception as e:
        log.warning("storage.dedup_check_failed", error=str(e))
        return {"is_duplicate": False}
