"""
app/ml_models/vision_model.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EfficientNet-B4 Deepfake Vision Classifier

Loads a fine-tuned EfficientNet-B4 with a 2-class classification head
(authentic vs deepfake). Supports:
  - PyTorch .pt weight loading
  - ONNX Runtime acceleration via onnx_wrapper
  - Grad-CAM heatmap generation over target conv layers
  - Graceful fallback to heuristic scoring when USE_MOCK_MODELS=true
"""
from __future__ import annotations

import io
import os
from typing import Dict, Any, Optional, Tuple

import numpy as np
import structlog
import os
from PIL import Image

from app.core.config import settings

log = structlog.get_logger(__name__)

# Image preprocessing constants (ImageNet normalization)
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)
INPUT_SIZE = 380  # EfficientNet-B4 optimal input resolution


def preprocess_image(pil_image: Image.Image) -> np.ndarray:
    """
    Preprocess a PIL Image for EfficientNet-B4 inference.

    Returns:
        np.ndarray shaped (1, 3, 380, 380) in float32 with ImageNet normalization.
    """
    img = pil_image.convert("RGB").resize((INPUT_SIZE, INPUT_SIZE), Image.BICUBIC)
    arr = np.array(img, dtype=np.float32) / 255.0
    # Normalize with ImageNet stats
    arr = (arr - IMAGENET_MEAN) / IMAGENET_STD
    # HWC → CHW, add batch dim
    arr = arr.transpose(2, 0, 1)[np.newaxis, ...]
    return arr


class GeneratorRouter:
    """Router that selects specialized sub‑models based on a lightweight pre‑screen.

    The router loads three optional sub‑models (Flux/Midjourney, Diffusion‑Grid, GAN‑FaceSwap).
    Each sub‑model must implement a ``predict(image_bytes) -> float`` returning a probability 0‑100.
    The router returns a dict ``{'flux': prob, 'grid': prob, 'gan': prob}``.
    """
    def __init__(self):
        self.sub_models = {
            "flux": self._load_sub_model(settings.SUBMODEL_FLUX_PATH),
            "grid": self._load_sub_model(settings.SUBMODEL_GRID_PATH),
            "gan": self._load_sub_model(settings.SUBMODEL_GAN_PATH),
        }
        # Default weights; can be overridden via settings
        self.weights = getattr(settings, "GENERATOR_ROUTER_WEIGHTS", {
            "flux": 0.4,
            "grid": 0.3,
            "gan": 0.3,
        })

    def _load_sub_model(self, path: str):
        """Load a sub‑model from ``path``.
        If the file does not exist, returns a lightweight mock that always returns 0.
        """
        if not path or not os.path.exists(path):
            return None
        # For simplicity we load via the same wrapper used for the main model
        try:
            from app.services.onnx_wrapper import ONNXModelWrapper
            return ONNXModelWrapper(path)
        except Exception as e:
            log.warning("router.submodel_load_failed", path=path, error=str(e))
            return None

    def _pre_screen(self, image: Image.Image) -> list:
        """Very cheap heuristic (FFT anomaly) to decide which sub‑models to run.
        Returns a list of keys to invoke.
        """
        from app.services.spatial_engine import _fft_anomaly_score
        score, _ = _fft_anomaly_score(image)
        # Simple rule: high score triggers all, medium triggers flux+grid, low only flux
        if score > 0.4:
            return ["flux", "grid", "gan"]
        if score > 0.2:
            return ["flux", "grid"]
        return ["flux"]

    def run(self, image_bytes: bytes) -> dict:
        """Run selected sub‑models and return weighted confidence dict.
        The image is opened once and reused.
        """
        pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        keys = self._pre_screen(pil)
        confidences = {}
        for k in keys:
            model = self.sub_models.get(k)
            if model is None:
                confidences[k] = 0.0
                continue
            try:
                # Assume sub‑model wrapper has a ``run_inference`` that returns logits
                # We map logits to probability via the existing helper
                if hasattr(model, "run_inference"):
                    # Build same 4‑channel input as main model (RGB + FFT)
                    # Re‑use the same FFT channel generation
                    from app.services.spatial_engine import _fft_anomaly_score
                    # Build input tensor
                    from app.ml_models.vision_model import preprocess_image
                    import torch
                    inp = preprocess_image(pil)
                    # Compute FFT channel
                    gray = np.array(pil.convert("L"), dtype=np.float32)
                    fft = np.fft.fft2(gray)
                    fft_shifted = np.fft.fftshift(fft)
                    magnitude = np.log1p(np.abs(fft_shifted))
                    import cv2
                    mag_resized = cv2.resize(magnitude, (380, 380), interpolation=cv2.INTER_AREA)
                    mag_min, mag_max = mag_resized.min(), mag_resized.max()
                    mag_norm = (mag_resized - mag_min) / (mag_max - mag_min + 1e-8)
                    fft_tensor = torch.from_numpy(mag_norm).unsqueeze(0).unsqueeze(0).float().to(settings.MODEL_DEVICE)
                    tensor = torch.from_numpy(inp).to(settings.MODEL_DEVICE)
                    combined = torch.cat([tensor, fft_tensor], dim=1)
                    logits = model.run_inference(combined.cpu().numpy())
                else:
                    logits = model.predict(image_bytes)
                # Convert logits to probability (0‑100) using existing helper
                prob, _ = DeepfakeVisionModel()._logits_to_probability(logits)
                confidences[k] = prob
            except Exception as e:
                log.error("router.submodel_predict_failed", key=k, error=str(e))
                confidences[k] = 0.0
        return confidences

class DeepfakeVisionModel:
    """
    Production EfficientNet-B4 deepfake classifier with Grad-CAM support.

    When USE_MOCK_MODELS=true (default), uses heuristic FFT-based scoring.
    When false, loads real PyTorch weights or ONNX session.
    """

    def __init__(self):
        self.model = None
        self.onnx_session = None
        self.device = settings.MODEL_DEVICE
        self.use_mock = settings.USE_MOCK_MODELS
        self._target_layer = None  # For Grad-CAM
        self.router = GeneratorRouter()

        # Disable mock mode if weights are present
        weight_path = settings.SPATIAL_MODEL_PATH
        onnx_path = weight_path.replace(".pt", ".onnx")
        if os.path.exists(weight_path) or os.path.exists(onnx_path):
            self.use_mock = False

        if not self.use_mock:
            self._load_model()


    def _load_model(self):
        """Load PyTorch EfficientNet-B4 or ONNX session."""
        weight_path = settings.SPATIAL_MODEL_PATH
        onnx_path = weight_path.replace(".pt", ".onnx")

        # Try ONNX first (faster inference)
        if os.path.exists(onnx_path):
            try:
                from app.services.onnx_wrapper import ONNXModelWrapper
                self.onnx_session = ONNXModelWrapper(onnx_path)
                log.info("vision_model.onnx_loaded", path=onnx_path)
                return
            except Exception as e:
                log.warning("vision_model.onnx_fallback", error=str(e))

        # Fallback to PyTorch
        if os.path.exists(weight_path):
            try:
                import torch
                import torchvision.models as models

                self.model = models.efficientnet_b4(weights=None)
                
                # Adapt first conv layer to accept 4 channels (RGB + FFT)
                original_conv = self.model.features[0][0]
                self.model.features[0][0] = torch.nn.Conv2d(
                    in_channels=4,
                    out_channels=original_conv.out_channels,
                    kernel_size=original_conv.kernel_size,
                    stride=original_conv.stride,
                    padding=original_conv.padding,
                    bias=original_conv.bias is not None
                )

                # Replace classifier head for 2-class output
                in_features = self.model.classifier[1].in_features
                self.model.classifier = torch.nn.Sequential(
                    torch.nn.Dropout(p=0.4, inplace=True),
                    torch.nn.Linear(in_features, 2),
                )
                state_dict = torch.load(weight_path, map_location=self.device, weights_only=True)
                if "features.0.0.weight" in state_dict:
                    w = state_dict["features.0.0.weight"]
                    if w.shape[1] == 3:
                        new_w = torch.zeros((w.shape[0], 4, w.shape[2], w.shape[3]), device=w.device)
                        new_w[:, :3] = w
                        new_w[:, 3] = w.mean(dim=1)
                        state_dict["features.0.0.weight"] = new_w
                self.model.load_state_dict(state_dict, strict=False)
                self.model.to(self.device)
                self.model.eval()

                # Store target layer for Grad-CAM
                self._target_layer = self.model.features[-1]

                log.info("vision_model.pytorch_loaded", path=weight_path, device=self.device)
            except Exception as e:
                log.error("vision_model.load_failed", error=str(e))
                self.use_mock = True
        else:
            log.warning("vision_model.weights_not_found", path=weight_path)
            self.use_mock = True

    def predict(self, image_buffer: bytes) -> Tuple[float, np.ndarray]:
        """
        Run deepfake classification on raw image bytes.

        Returns:
            (deepfake_probability, logits) where probability is 0-100 scale.
        """
        pil_image = Image.open(io.BytesIO(image_buffer)).convert("RGB")
        input_tensor = preprocess_image(pil_image)

        if self.use_mock:
            return self._mock_predict(image_buffer)

        # ONNX inference
        if self.onnx_session and self.onnx_session.session:
            logits = self.onnx_session.run_inference(input_tensor)
            return self._logits_to_probability(logits)

        # PyTorch inference with secondary high‑frequency inspection for ambiguous scores
        if self.model is not None:
            import torch
            from app.services.spatial_engine import _fft_anomaly_score
            with torch.no_grad():
                tensor = torch.from_numpy(input_tensor).to(self.device)
                
                # Compute FFT magnitude channel
                try:
                    gray = np.array(pil_image.convert("L"), dtype=np.float32)
                    fft = np.fft.fft2(gray)
                    fft_shifted = np.fft.fftshift(fft)
                    magnitude = np.log1p(np.abs(fft_shifted))
                    
                    import cv2
                    mag_resized = cv2.resize(magnitude, (380, 380), interpolation=cv2.INTER_AREA)
                    mag_min, mag_max = mag_resized.min(), mag_resized.max()
                    mag_norm = (mag_resized - mag_min) / (mag_max - mag_min + 1e-8)
                except Exception:
                    mag_norm = np.zeros((380, 380), dtype=np.float32)
                
                fft_tensor = torch.from_numpy(mag_norm).unsqueeze(0).unsqueeze(0).float().to(self.device)
                inp_combined = torch.cat([tensor, fft_tensor], dim=1)
                
                logits = self.model(inp_combined).cpu().numpy()
                deepfake_prob, logits = self._logits_to_probability(logits)
                # Apply FFT‑based boost for high‑frequency anomaly patterns
                fft_score, _ = _fft_anomaly_score(pil_image)
                # If FFT anomaly is significant, increase confidence proportionally
                if fft_score > 0.25:
                    # Scale boost to amplify deepfake probability (up to 50 points)
                    deepfake_prob = min(100.0, deepfake_prob + fft_score * 50.0)
                # Retain original ambiguous range boost for safety
                if 35.0 <= deepfake_prob <= 50.0:
                    deepfake_prob = min(100.0, deepfake_prob + fft_score * 20.0)
                # --- Router integration ---
                router_scores = self.router.run(image_buffer)
                weighted_router = sum(
                    router_scores.get(k, 0) * self.router.weights.get(k, 0)
                    for k in self.router.weights
                )
                # Blend main model score with router ensemble (simple average)
                final_prob = (deepfake_prob + weighted_router) / 2.0
                return final_prob, logits

        return self._mock_predict(image_buffer)

    def generate_gradcam(self, image_buffer: bytes) -> Optional[Tuple[str, np.ndarray]]:
        """Generate Grad‑CAM heatmap.

        Returns a tuple ``(base64_png, matrix)`` where ``matrix`` is a 2‑D float array
        normalized to ``0‑1``. Returns ``None`` if the model is in mock mode or an error occurs.
        """
        if self.use_mock or self.model is None or self._target_layer is None:
            return None

        try:
            import torch
            import base64

            pil_image = Image.open(io.BytesIO(image_buffer)).convert("RGB")
            input_tensor = preprocess_image(pil_image)
            tensor = torch.from_numpy(input_tensor).to(self.device)
            tensor.requires_grad_(True)

            # Compute FFT magnitude channel (same as in predict)
            try:
                gray = np.array(pil_image.convert("L"), dtype=np.float32)
                fft = np.fft.fft2(gray)
                fft_shifted = np.fft.fftshift(fft)
                magnitude = np.log1p(np.abs(fft_shifted))
                import cv2
                mag_resized = cv2.resize(magnitude, (380, 380), interpolation=cv2.INTER_AREA)
                mag_min, mag_max = mag_resized.min(), mag_resized.max()
                mag_norm = (mag_resized - mag_min) / (mag_max - mag_min + 1e-8)
            except Exception:
                mag_norm = np.zeros((380, 380), dtype=np.float32)

            fft_tensor = torch.from_numpy(mag_norm).unsqueeze(0).unsqueeze(0).float().to(self.device)
            inp_combined = torch.cat([tensor, fft_tensor], dim=1)

            # Forward pass with gradient tracking
            activations = {}
            gradients = {}

            def forward_hook(module, inp, out):
                activations["value"] = out.detach()

            def backward_hook(module, grad_in, grad_out):
                gradients["value"] = grad_out[0].detach()

            fwd_handle = self._target_layer.register_forward_hook(forward_hook)
            bwd_handle = self._target_layer.register_full_backward_hook(backward_hook)

            output = self.model(inp_combined)
            # Backprop on deepfake class (index 1)
            self.model.zero_grad()
            idx = getattr(settings, "DEEPFAKE_CLASS_INDEX", 1)
            output[0, idx].backward()

            fwd_handle.remove()
            bwd_handle.remove()

            # Compute Grad‑CAM
            act = activations["value"].squeeze(0)  # (C, H, W)
            grad = gradients["value"].squeeze(0)    # (C, H, W)
            weights = grad.mean(dim=(1, 2))         # (C,)
            cam = (weights[:, None, None] * act).sum(dim=0)  # (H, W)
            cam = torch.relu(cam)
            cam = cam / (cam.max() + 1e-8)

            # Convert to numpy and encode as PNG base64
            cam_np = cam.cpu().numpy()
            from scipy.ndimage import zoom
            orig_size = pil_image.size  # (W, H)
            scale_h = orig_size[1] / cam_np.shape[0]
            scale_w = orig_size[0] / cam_np.shape[1]
            cam_resized = zoom(cam_np, (scale_h, scale_w), order=1)
            cam_resized = np.clip(cam_resized, 0, 1)

            # Apply colormap (red-hot)
            heatmap = np.zeros((*cam_resized.shape, 4), dtype=np.uint8)
            heatmap[..., 0] = (cam_resized * 255).astype(np.uint8)  # Red
            heatmap[..., 1] = ((1 - cam_resized) * 50).astype(np.uint8)  # Slight green
            heatmap[..., 3] = (cam_resized * 180).astype(np.uint8)  # Alpha

            heatmap_img = Image.fromarray(heatmap, "RGBA")
            buf = io.BytesIO()
            heatmap_img.save(buf, format="PNG")
            return base64.b64encode(buf.getvalue()).decode("utf-8")

        except Exception as e:
            log.warning("vision_model.gradcam_failed", error=str(e))
            return None

    def _logits_to_probability(self, logits: np.ndarray) -> Tuple[float, np.ndarray]:
        """Convert raw logits to deepfake probability (0-100)."""
        from scipy.special import softmax
        probs = softmax(logits[0])
        # Use configurable class index for deepfake probability
        idx = settings.DEEPFAKE_CLASS_INDEX if hasattr(settings, "DEEPFAKE_CLASS_INDEX") else 1
        deepfake_prob = float(probs[idx]) * 100.0
        return deepfake_prob, logits

    def _mock_predict(self, image_buffer: bytes) -> Tuple[float, np.ndarray]:
        """
        Heuristic FFT-based mock prediction for development.
        Analyzes high-frequency energy ratio as a proxy for GAN artifacts.
        """
        try:
            from app.services.spatial_engine import _fft_anomaly_score, _dct_anomaly_score, _heuristic_score
            pil_rgb = Image.open(io.BytesIO(image_buffer)).convert("RGB")
            fft_score, _ = _fft_anomaly_score(pil_rgb)
            dct_score = _dct_anomaly_score(pil_rgb)
            prob = _heuristic_score(fft_score, 0, dct_score=dct_score, pil_img=pil_rgb)
            return prob, np.array([[100.0 - prob, prob]], dtype=np.float32)
        except Exception as e:
            log.warning("vision_model.mock_predict_failed", error=str(e))
            return 15.0, np.array([[85.0, 15.0]], dtype=np.float32)


    def get_model_info(self) -> Dict[str, Any]:
        """Return model metadata for API responses."""
        return {
            "model_name": "EfficientNet-B4",
            "model_type": "vision_deepfake_classifier",
            "input_size": INPUT_SIZE,
            "num_classes": 2,
            "device": self.device,
            "is_mock": self.use_mock,
            "backend": "onnx" if self.onnx_session else ("pytorch" if self.model else "heuristic"),
        }
