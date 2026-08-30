# backend/scripts/generate_dummy_weights.py
import os
import torch
import torch.nn as nn
import torchvision.models as tv_models

def main():
    os.makedirs("weights", exist_ok=True)

    # 1. Create adapted EfficientNet-B4 PyTorch weights
    model = tv_models.efficientnet_b4(weights=None)
    original_conv = model.features[0][0]
    model.features[0][0] = nn.Conv2d(
        in_channels=4,
        out_channels=original_conv.out_channels,
        kernel_size=original_conv.kernel_size,
        stride=original_conv.stride,
        padding=original_conv.padding,
        bias=original_conv.bias is not None
    )
    in_features = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.4, inplace=True),
        nn.Linear(in_features, 2),
    )

    # Save PT weights
    torch.save(model.state_dict(), "weights/efficientnet_b4_deepfake.pt")

    # 2. Save ONNX format
    model.eval()
    dummy_input = torch.randn(1, 4, 380, 380)
    torch.onnx.export(
        model,
        dummy_input,
        "weights/efficientnet_b4_deepfake.onnx",
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch_size"}, "output": {0: "batch_size"}},
        opset_version=14
    )
    # Copy to deepguard_spatial.onnx
    import shutil
    shutil.copy("weights/efficientnet_b4_deepfake.onnx", "weights/deepguard_spatial.onnx")
    print("Generated dummy PyTorch and ONNX weights successfully.")

if __name__ == "__main__":
    main()
