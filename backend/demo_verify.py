import os
import sys
import io
import asyncio
from PIL import Image
import numpy as np

# Ensure backend/ is in the Python search path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

async def main():
    print("Testing verification pipeline with a synthetic clean image...")
    
    # Create a synthetic clean 500x500 RGB image with a smooth gradient to prevent FFT frequency spikes
    w, h = 500, 500
    r = np.tile(np.linspace(0, 255, w, dtype=np.uint8), (h, 1))
    g = np.tile(np.linspace(0, 255, h, dtype=np.uint8).reshape(-1, 1), (1, w))
    b = np.uint8(128 * np.ones((h, w)))
    img_data = np.stack([r, g, b], axis=-1)
    
    img = Image.fromarray(img_data, "RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    img_bytes = buf.getvalue()
    
    # Import engines and models
    from app.services.spatial_engine import analyze_image
    from app.ml_models.vision_model import DeepfakeVisionModel
    from app.services.orchestrator import dispatch_file_scan
    
    # 1. Test spatial engine directly
    print("Executing SpatialEngine analysis...")
    spatial_result = await analyze_image(img_bytes)
    print(f"Spatial Engine Confidence (Risk): {spatial_result.confidence}%")
    print(f"Spatial Engine Verdict: {spatial_result.verdict}")
    
    # 2. Test VisionModel directly
    print("Executing VisionModel prediction...")
    vision_model = DeepfakeVisionModel()
    model_prob, _ = vision_model.predict(img_bytes)
    print(f"Vision Model Risk Probability: {model_prob}%")
    
    # 3. Test Orchestrator flow
    print("Executing full Orchestrator dispatch...")
    response = await dispatch_file_scan(img_bytes, "synthetic_clean.jpg", "image/jpeg")
    print(f"Aggregated Risk Confidence: {response.confidence}%")
    print(f"Verdict: {response.verdict}")
    print(f"Trust Level: {response.simple_summary['trust_level']}")
    print(f"Flags: {[f.label for f in response.flags]}")
    
    # Assertions
    assert response.confidence < 35.0, f"Error: Risk score ({response.confidence}%) is not below 35.0%!"
    assert response.verdict == "AUTHENTIC", f"Error: Unexpected verdict {response.verdict}!"
    assert response.simple_summary["trust_level"] == "GREEN", f"Error: Unexpected trust level {response.simple_summary['trust_level']}!"
    
    print("\nSUCCESS: Verification passed. System is presentation-ready!")

if __name__ == "__main__":
    asyncio.run(main())
