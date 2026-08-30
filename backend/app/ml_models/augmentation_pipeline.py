import cv2
import numpy as np
import torch
import albumentations as A
from albumentations.core.transforms_interface import ImageOnlyTransform
import random

class JPEGCompression(ImageOnlyTransform):
    """Random JPEG compression with quality in a given range.
    The transform encodes the image to JPEG and decodes it back, introducing compression artifacts.
    """
    def __init__(self, quality_range=(40, 85), always_apply=False, p=1.0):
        super().__init__(always_apply, p)
        self.quality_range = quality_range

    def apply(self, img, **params):
        # img is a numpy array in BGR format (as Albumentations works with np.ndarray)
        quality = random.randint(*self.quality_range)
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
        success, encimg = cv2.imencode('.jpg', img, encode_param)
        if not success:
            return img
        decimg = cv2.imdecode(encimg, cv2.IMREAD_COLOR)
        return decimg

    def get_transform_init_args_names(self):
        return ("quality_range",)

def get_degradation_transform():
    """Return an Albumentations Compose object that applies a series of realistic degradations.
    The pipeline returns an image (numpy HxWxC) that can be later converted to torch Tensor.
    """
    return A.Compose([
        JPEGCompression(quality_range=(40, 85), p=0.7),
        A.OneOf([
            A.GaussianBlur(blur_limit=(3, 7), sigma_limit=(0.5, 1.5), p=0.5),
            A.MotionBlur(blur_limit=7, p=0.5),
        ], p=0.5),
        A.RandomResizedCrop(size=(256, 256), scale=(0.7, 1.0), ratio=(0.9, 1.1), p=0.6),
        A.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.1, p=0.5),
        A.ISONoise(color_shift=(0.01, 0.05), intensity=(0.1, 0.5), p=0.3),
        A.Sharpen(alpha=(0.1, 0.3), lightness=(0.5, 1.0), p=0.3),
    ], p=1.0)

def augment_and_fft(image: np.ndarray):
    """Apply degradation pipeline to an image and return both the RGB tensor and its FFT magnitude map.
    Args:
        image: np.ndarray in RGB format (H, W, C) with values 0‑255.
    Returns:
        rgb_tensor: torch.FloatTensor shape (3, H, W) in [0,1]
        fft_tensor: torch.FloatTensor shape (3, H, W) – magnitude of 2‑D FFT per channel.
    """
    # Albumentations expects BGR, convert
    img_bgr = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
    transform = get_degradation_transform()
    augmented = transform(image=img_bgr)
    aug_bgr = augmented["image"]
    # back to RGB
    aug_rgb = cv2.cvtColor(aug_bgr, cv2.COLOR_BGR2RGB)
    # to torch tensor
    rgb_tensor = torch.from_numpy(aug_rgb).permute(2, 0, 1).float() / 255.0
    # compute 2‑D FFT per channel
    fft_complex = torch.fft.fft2(rgb_tensor)
    fft_magnitude = torch.abs(fft_complex)
    return rgb_tensor, fft_magnitude

# Additional augmentations for diverse edge‑case media

class LowResolutionResize(ImageOnlyTransform):
    """Randomly downscale and upscale an image to simulate low‑resolution media (e.g., WhatsApp, screenshots)."""
    def __init__(self, scale_range=(0.3, 0.8), always_apply=False, p=0.5):
        super().__init__(always_apply, p)
        self.scale_range = scale_range

    def apply(self, img, **params):
        h, w = img.shape[:2]
        scale = random.uniform(*self.scale_range)
        new_h, new_w = int(h * scale), int(w * scale)
        # downscale then upscale back to original size
        down = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
        up = cv2.resize(down, (w, h), interpolation=cv2.INTER_LINEAR)
        return up

    def get_transform_init_args_names(self):
        return ("scale_range",)

class DemographicVariation(ImageOnlyTransform):
    """Adjust brightness and contrast to emulate diverse lighting and skin tones."""
    def __init__(self, brightness=(0.5, 1.5), contrast=(0.5, 1.5), always_apply=False, p=0.5):
        super().__init__(always_apply, p)
        self.brightness = brightness
        self.contrast = contrast

    def apply(self, img, **params):
        beta = random.uniform(*self.brightness) * 50  # shift brightness
        alpha = random.uniform(*self.contrast)       # change contrast
        img = cv2.convertScaleAbs(img, alpha=alpha, beta=beta)
        return img

    def get_transform_init_args_names(self):
        return ("brightness", "contrast",)

# Extend the degradation pipeline to include new transforms
def get_degradation_transform():
    return A.Compose([
        JPEGCompression(quality_range=(40, 85), p=0.7),
        LowResolutionResize(scale_range=(0.3, 0.8), p=0.5),
        DemographicVariation(p=0.5),
        A.OneOf([
            A.GaussianBlur(blur_limit=(3, 7), sigma_limit=(0.5, 1.5), p=0.5),
            A.MotionBlur(blur_limit=7, p=0.5),
        ], p=0.5),
        A.RandomResizedCrop(size=(256, 256), scale=(0.7, 1.0), ratio=(0.9, 1.1), p=0.6),
        A.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.1, p=0.5),
        A.ISONoise(color_shift=(0.01, 0.05), intensity=(0.1, 0.5), p=0.3),
        A.Sharpen(alpha=(0.1, 0.3), lightness=(0.5, 1.0), p=0.3),
    ], p=1.0)
