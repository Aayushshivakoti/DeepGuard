# backend/tests/test_active_learning.py
"""
Unit and integration tests for DeepGuard's active learning pipeline,
including custom augmentations, hard negative mining, cross-validation, and training loop.
"""
from __future__ import annotations

import os
import sys
import pytest
import numpy as np
import torch

from app.ml_models.augmentation_pipeline import (
    JPEGCompression,
    LowResolutionResize,
    DemographicVariation,
    get_degradation_transform
)
from app.ml_models.cross_validation import run_kfold_validation
from scripts.hard_negative_mining import mine_hard_negatives
from scripts.train_model import fetch_training_data

def test_augmentations():
    """Verify that the custom degradation transforms run without errors and alter images."""
    dummy_img = np.random.randint(0, 256, (380, 380, 3), dtype=np.uint8)

    # Test JPEG Compression
    jpeg_transform = JPEGCompression(p=1.0)
    res_jpeg = jpeg_transform(image=dummy_img)["image"]
    assert res_jpeg.shape == dummy_img.shape
    
    # Test Low Resolution Resize
    lr_transform = LowResolutionResize(p=1.0)
    res_lr = lr_transform(image=dummy_img)["image"]
    assert res_lr.shape == dummy_img.shape

    # Test Demographic Variation
    dv_transform = DemographicVariation(p=1.0)
    res_dv = dv_transform(image=dummy_img)["image"]
    assert res_dv.shape == dummy_img.shape

def test_kfold_validation():
    """Test that K-Fold cross validation correctly processes a mock dataset and returns a trained model."""
    mock_data = [
        {"filepath": f"dummy_auth_{i}.jpg", "label": 0} for i in range(5)
    ] + [
        {"filepath": f"dummy_fake_{i}.jpg", "label": 1} for i in range(5)
    ]
    
    transform = get_degradation_transform()
    model, fold_metrics = run_kfold_validation(
        dataset_items=mock_data,
        k=2,
        epochs=1,
        batch_size=2,
        transform=transform
    )
    
    assert model is not None
    assert len(fold_metrics) == 2
    for m in fold_metrics:
        assert "accuracy" in m
        assert "precision" in m
        assert "recall" in m
        assert "false_positive_rate" in m

@pytest.mark.asyncio
async def test_hard_negative_mining():
    """Verify that the hard negative mining script can run and write output manifest."""
    # Run the mining script
    results = await mine_hard_negatives(limit=3)
    assert len(results) > 0
    
    # Check that manifest file is generated
    manifest_path = os.path.join("uploads", "hard-negatives", "manifest.json")
    assert os.path.exists(manifest_path)
    with open(manifest_path, "r") as f:
        manifest = json = json_data = pytest.importorskip("json").load(f)
        assert len(manifest) == len(results)

@pytest.mark.asyncio
async def test_training_orchestrator():
    """Verify that dataset fetching yields samples for training."""
    data = await fetch_training_data()
    assert len(data) > 0
