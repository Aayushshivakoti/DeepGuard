# backend/app/ml_models/cross_validation.py
"""
K-Fold Cross-Validation module for DeepGuard classifiers.
Supports PyTorch models with CPU fallback, logging fold metrics,
and training lightweight heads to run efficiently on a laptop.
"""
from __future__ import annotations

import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader, Subset
from sklearn.model_selection import KFold
import numpy as np
from typing import List, Dict, Any, Tuple, Callable

import structlog
log = structlog.get_logger(__name__)

# Basic lightweight binary classifier model
class LightweightBinaryClassifier(nn.Module):
    """
    Lightweight model for deepfake classification (Authentic vs. Deepfake).
    Uses a simple CNN with global average pooling to run quickly on CPU/laptops.
    """
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 16, kernel_size=3, padding=1),
            nn.BatchNorm2d(16),
            nn.ReLU(),
            nn.MaxPool2d(2),
            
            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2),
            
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.AdaptiveAvgPool2d((1, 1))
        )
        self.classifier = nn.Sequential(
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(32, 2)  # Logits for 2 classes (Authentic, Deepfake)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.features(x)
        x = torch.flatten(x, 1)
        return self.classifier(x)


class ActiveLearningDataset(Dataset):
    """
    Dataset wrapper that accepts a list of image file paths and labels,
    applying optional albumentations transforms.
    """
    def __init__(self, items: list[dict], transform: Callable | None = None):
        """
        Args:
            items: List of dicts, each with keys: "filepath" (str) and "label" (int, 0 for Authentic, 1 for Deepfake)
            transform: Albumentations Compose transform pipeline.
        """
        self.items = items
        self.transform = transform

    def __len__(self) -> int:
        return len(self.items)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int]:
        item = self.items[idx]
        filepath = item["filepath"]
        label = item["label"]
        
        # Load image; if load fails or doesn't exist, create synthetic dummy image
        import cv2
        img = None
        if os.path.exists(filepath):
            img = cv2.imread(filepath)
            if img is not None:
                img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                
        if img is None:
            # Synthetic placeholder image (256x256x3)
            img = np.random.randint(0, 256, (256, 256, 3), dtype=np.uint8)

        if self.transform:
            augmented = self.transform(image=img)
            img = augmented["image"]
            # Convert to RGB tensor
            img_tensor = torch.from_numpy(img).permute(2, 0, 1).float() / 255.0
        else:
            img_tensor = torch.from_numpy(img).permute(2, 0, 1).float() / 255.0
            
        return img_tensor, label


def train_epoch(model: nn.Module, loader: DataLoader, criterion: nn.Module, optimizer: optim.Optimizer, device: torch.device) -> Tuple[float, float]:
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0
    
    for inputs, labels in loader:
        inputs, labels = inputs.to(device), labels.to(device)
        optimizer.zero_grad()
        
        outputs = model(inputs)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        
        running_loss += loss.item() * inputs.size(0)
        _, predicted = outputs.max(1)
        total += labels.size(0)
        correct += predicted.eq(labels).sum().item()
        
    epoch_loss = running_loss / total
    epoch_acc = correct / total
    return epoch_loss, epoch_acc


def evaluate_model(model: nn.Module, loader: DataLoader, device: torch.device) -> Tuple[float, float, float, float]:
    """
    Evaluate model and return accuracy, precision, recall, and false positive rate.
    """
    model.eval()
    y_true = []
    y_pred = []
    
    with torch.no_grad():
        for inputs, labels in loader:
            inputs = inputs.to(device)
            outputs = model(inputs)
            _, predicted = outputs.max(1)
            
            y_true.extend(labels.numpy())
            y_pred.extend(predicted.cpu().numpy())
            
    y_true = np.array(y_true)
    y_pred = np.array(y_pred)
    
    total = len(y_true)
    correct = np.sum(y_true == y_pred)
    acc = correct / total if total > 0 else 0.0
    
    # Binary metrics (1 = Deepfake, 0 = Authentic)
    tp = np.sum((y_true == 1) & (y_pred == 1))
    fp = np.sum((y_true == 0) & (y_pred == 1))
    fn = np.sum((y_true == 1) & (y_pred == 0))
    tn = np.sum((y_true == 0) & (y_pred == 0))
    
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    
    return acc, precision, recall, fpr


def run_kfold_validation(
    dataset_items: list[dict],
    k: int = 3,
    epochs: int = 5,
    batch_size: int = 8,
    transform: Callable | None = None
) -> Tuple[nn.Module, List[Dict[str, Any]]]:
    """
    Runs K-Fold cross validation and returns the best model along with collected fold metrics.
    """
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    log.info("kfold.init", folds=k, device=str(device), dataset_size=len(dataset_items))
    
    dataset = ActiveLearningDataset(dataset_items, transform=transform)
    kf = KFold(n_splits=k, shuffle=True, random_state=42)
    
    fold_metrics = []
    best_acc = -1.0
    best_model_state = None
    
    # Instantiate candidate model
    model = LightweightBinaryClassifier().to(device)
    
    for fold, (train_idx, val_idx) in enumerate(kf.split(dataset_items)):
        log.info("kfold.fold_start", fold=fold + 1)
        
        # Split datasets
        train_sub = Subset(dataset, train_idx)
        val_sub = Subset(dataset, val_idx)
        
        train_loader = DataLoader(train_sub, batch_size=batch_size, shuffle=True)
        val_loader = DataLoader(val_sub, batch_size=batch_size, shuffle=False)
        
        # Reset model weights for fresh fold training
        fold_model = LightweightBinaryClassifier().to(device)
        criterion = nn.CrossEntropyLoss()
        optimizer = optim.AdamW(fold_model.parameters(), lr=1e-3, weight_decay=1e-2)
        
        for epoch in range(epochs):
            train_loss, train_acc = train_epoch(fold_model, train_loader, criterion, optimizer, device)
            log.debug("kfold.epoch_stats", fold=fold + 1, epoch=epoch + 1, loss=train_loss, acc=train_acc)
            
        # Evaluation
        acc, prec, rec, fpr = evaluate_model(fold_model, val_loader, device)
        log.info("kfold.fold_complete", fold=fold + 1, acc=acc, precision=prec, recall=rec, fpr=fpr)
        
        fold_metrics.append({
            "fold": fold + 1,
            "accuracy": acc,
            "precision": prec,
            "recall": rec,
            "false_positive_rate": fpr
        })
        
        # Save best model weight state
        if acc > best_acc:
            best_acc = acc
            best_model_state = fold_model.state_dict()
            
    # Load best weights into return model
    if best_model_state:
        model.load_state_dict(best_model_state)
        
    return model, fold_metrics
