"""
app/ml_models — Production ML Model Registry & Loaders
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Lazy-loaded model singletons for EfficientNet-B4 vision,
voice-clone audio, GPT-2 text detection, GAN fingerprinting,
and cross-modal consistency checking.
"""
from __future__ import annotations

import structlog

log = structlog.get_logger(__name__)

# Lazy singletons — initialized on first access
_vision_model = None
_audio_model = None
_text_detector = None
_gan_fingerprinter = None
_cross_modal_checker = None


def get_vision_model():
    """Return the singleton EfficientNet-B4 deepfake vision classifier."""
    global _vision_model
    if _vision_model is None:
        from app.ml_models.vision_model import DeepfakeVisionModel
        _vision_model = DeepfakeVisionModel()
        log.info("ml_models.vision_model_loaded")
    return _vision_model


def get_audio_model():
    """Return the singleton voice-clone audio classifier."""
    global _audio_model
    if _audio_model is None:
        from app.ml_models.audio_model import VoiceCloneDetector
        _audio_model = VoiceCloneDetector()
        log.info("ml_models.audio_model_loaded")
    return _audio_model


def get_text_detector():
    """Return the singleton GPTZero-style AI text detector."""
    global _text_detector
    if _text_detector is None:
        from app.ml_models.text_detector import AITextDetector
        _text_detector = AITextDetector()
        log.info("ml_models.text_detector_loaded")
    return _text_detector


def get_gan_fingerprinter():
    """Return the singleton GAN model fingerprinter."""
    global _gan_fingerprinter
    if _gan_fingerprinter is None:
        from app.ml_models.gan_fingerprint import GANFingerprinter
        _gan_fingerprinter = GANFingerprinter()
        log.info("ml_models.gan_fingerprinter_loaded")
    return _gan_fingerprinter


def get_cross_modal_checker():
    """Return the singleton cross-modal consistency checker."""
    global _cross_modal_checker
    if _cross_modal_checker is None:
        from app.ml_models.cross_modal import CrossModalConsistencyChecker
        _cross_modal_checker = CrossModalConsistencyChecker()
        log.info("ml_models.cross_modal_checker_loaded")
    return _cross_modal_checker
