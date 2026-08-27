import pytest
from app.services.spatial_engine import analyze_image

# Helper to load a real JPEG sample (provided by test fixtures)
@pytest.mark.asyncio
async def test_real_image_low_risk(sample_jpeg_bytes: bytes):
    """Real DSLR/camera photos should have low deepfake risk (<35%)."""
    result = await analyze_image(sample_jpeg_bytes)
    assert result.confidence < 35.0, f"Real image risk too high: {result.confidence}%"

@pytest.mark.asyncio
async def test_ai_generated_image_high_risk():
    """Synthetic high‑frequency noise image should be flagged as deepfake (>50%)."""
    import numpy as np
    from PIL import Image
    import io

    # Generate a random noise image (380x380) – mimics AI artefacts
    arr = np.random.randint(0, 256, (380, 380, 3), dtype=np.uint8)
    img = Image.fromarray(arr, mode="RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    fake_bytes = buf.getvalue()

    result = await analyze_image(fake_bytes)
    assert result.confidence > 50.0, f"AI‑generated image not flagged: {result.confidence}%"
