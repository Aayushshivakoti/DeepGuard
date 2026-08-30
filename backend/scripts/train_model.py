# backend/scripts/train_model.py
"""
Orchestrates retraining on mined hard negatives and retrain queue datasets.
Trains the LightweightBinaryClassifier model, executes K-Fold Cross-Validation,
exports weights to ONNX format, and registers the model in DeepGuard.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
import json
import torch
from pathlib import Path
from datetime import datetime, timezone

# Ensure backend directory is in the path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.db.models.retrain_queue import RetrainQueue
from app.db.models.scan_record import ScanRecord
from app.ml_models.cross_validation import run_kfold_validation, LightweightBinaryClassifier
from app.ml_models.augmentation_pipeline import get_degradation_transform
from app.services.storage_service import _get_s3_client
from sqlalchemy import select

import structlog
log = structlog.get_logger(__name__)

async def fetch_training_data() -> list[dict]:
    """
    Query RetrainQueue and ScanRecord to compile the training list.
    Returns:
        List of dicts containing "filepath" and "label" (0 = Authentic, 1 = Deepfake)
    """
    training_data = []

    async with AsyncSessionLocal() as db:
        # 1. Fetch RetrainQueue entries that have admin corrected verdicts
        stmt_queue = select(RetrainQueue).where(RetrainQueue.admin_corrected_verdict.is_not(None))
        res_queue = await db.execute(stmt_queue)
        queue_records = res_queue.scalars().all()
        for r in queue_records:
            label = 0 if r.admin_corrected_verdict == "AUTHENTIC" else 1
            training_data.append({
                "filepath": r.media_path,
                "label": label,
                "source": "retrain_queue"
            })

        # 2. Fetch ScanRecords that have high confidence / definitive labels
        stmt_scans = select(ScanRecord).where(ScanRecord.verdict.in_(["AUTHENTIC", "SYNTHETIC_DEEPFAKE"]))
        res_scans = await db.execute(stmt_scans)
        scan_records = res_scans.scalars().all()
        for s in scan_records:
            label = 0 if s.verdict == "AUTHENTIC" else 1
            # Filter duplicates
            filepaths = [item["filepath"] for item in training_data]
            if s.filename and s.filename not in filepaths:
                training_data.append({
                    "filepath": s.filename,
                    "label": label,
                    "source": "scan_record"
                })

    log.info("train.data_fetched", db_records=len(training_data))
    
    # If no data found, return seed demo data
    if not training_data:
        log.info("train.seeding_demo_data", reason="No data available in DB")
        training_data = get_demo_training_dataset()

    return training_data

def get_demo_training_dataset() -> list[dict]:
    """Provide a basic dataset of mock images for demo runs."""
    demo_dir = Path("uploads/demo_train_dataset")
    demo_dir.mkdir(parents=True, exist_ok=True)
    
    dataset = []
    # Create simple dummy images
    import cv2
    import numpy as np
    
    for i in range(10):
        # Authentic images (label 0)
        auth_path = demo_dir / f"auth_{i}.jpg"
        if not auth_path.exists():
            img = np.random.randint(50, 150, (256, 256, 3), dtype=np.uint8)
            cv2.imwrite(str(auth_path), img)
        dataset.append({"filepath": str(auth_path), "label": 0, "source": "demo"})

        # Deepfake images (label 1)
        fake_path = demo_dir / f"fake_{i}.jpg"
        if not fake_path.exists():
            img = np.random.randint(100, 250, (256, 256, 3), dtype=np.uint8)
            cv2.imwrite(str(fake_path), img)
        dataset.append({"filepath": str(fake_path), "label": 1, "source": "demo"})

    return dataset

def export_model_to_onnx(model: torch.nn.Module, onnx_output_path: str):
    """Export model to ONNX format."""
    model.eval()
    dummy_input = torch.randn(1, 3, 256, 256)
    
    log.info("train.export_onnx_start", path=onnx_output_path)
    torch.onnx.export(
        model,
        dummy_input,
        onnx_output_path,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch_size"}, "output": {0: "batch_size"}},
        opset_version=14
    )
    log.info("train.export_onnx_complete", path=onnx_output_path)

def upload_onnx_to_cloud(local_onnx_path: str, bucket_name: str, s3_key: str):
    """Uploads the ONNX weight file to the configured S3 cloud bucket."""
    s3_client = _get_s3_client()
    if not s3_client:
        log.info("train.cloud_upload_skipped", reason="S3 credentials not configured")
        return
        
    try:
        log.info("train.upload_to_s3", bucket=bucket_name, key=s3_key)
        s3_client.upload_file(local_onnx_path, bucket_name, s3_key)
        log.info("train.upload_to_s3_success", bucket=bucket_name, key=s3_key)
    except Exception as e:
        log.error("train.upload_to_s3_failed", error=str(e))

async def run_orchestrated_training(args):
    log.info("train.start", folds=args.folds, epochs=args.epochs)
    
    # 1. Fetch active learning training tuples
    data_items = await fetch_training_data()
    
    # 2. Setup Augmentation pipeline
    transform = get_degradation_transform()
    
    # 3. K-Fold Cross Validation
    best_model, fold_metrics = run_kfold_validation(
        dataset_items=data_items,
        k=args.folds,
        epochs=args.epochs,
        batch_size=args.batch_size,
        transform=transform
    )
    
    # Print metrics
    for metric in fold_metrics:
        log.info("train.fold_metric", **metric)
        
    # Average accuracy calculation
    avg_acc = sum(m["accuracy"] for m in fold_metrics) / len(fold_metrics)
    log.info("train.cross_val_average", avg_accuracy=avg_acc)
    
    # 4. Train final model on complete dataset
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    # In this execution path, the best fold model is already returned. We can export it.
    
    # 5. Export to ONNX
    onnx_filename = f"deepguard_retrained_{datetime.now(timezone.utc).strftime('%Y%m%d')}.onnx"
    local_onnx_dir = Path("weights")
    local_onnx_dir.mkdir(parents=True, exist_ok=True)
    local_onnx_path = local_onnx_dir / onnx_filename
    
    export_model_to_onnx(best_model, str(local_onnx_path))
    
    # 6. Upload ONNX model to cloud bucket
    s3_key = f"models/{onnx_filename}"
    upload_onnx_to_cloud(str(local_onnx_path), settings.AUG_DATASET_BUCKET, s3_key)
    
    # Write model version metadata
    meta = {
        "model_version": f"DeepGuard-AL-{datetime.now(timezone.utc).strftime('%Y%m%d')}",
        "avg_cross_val_accuracy": avg_acc,
        "metrics": fold_metrics,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    meta_path = local_onnx_dir / "latest_model_meta.json"
    meta_path.write_text(json.dumps(meta, indent=2))
    log.info("train.metadata_saved", path=str(meta_path))
    
    # 7. Update active telemetry configuration
    os.environ["DEEPGUARD_MODEL_VERSION"] = meta["model_version"]
    log.info("train.telemetry_configured", model_version=meta["model_version"])

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Orchestrated Retraining Loop")
    parser.add_argument("--folds", type=int, default=3, help="Number of cross-validation folds")
    parser.add_argument("--epochs", type=int, default=3, help="Training epochs per fold")
    parser.add_argument("--batch-size", type=int, default=8, help="Batch size for training")
    args = parser.parse_args()
    
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer()
        ]
    )
    
    asyncio.run(run_orchestrated_training(args))
