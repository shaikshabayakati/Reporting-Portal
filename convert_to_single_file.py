import torch
import torch.onnx
import torchvision.models as models

print("Loading checkpoint...")
checkpoint = torch.load('pothole_classifier_mobilenetv3.pth', map_location='cpu')

print("Checkpoint keys:", checkpoint.keys())

# Try MobileNetV3 Small (more likely based on the layer sizes)
print("Creating MobileNetV3-Small model...")
model = models.mobilenet_v3_small(weights=None)

# Modify the classifier for binary classification
model.classifier[3] = torch.nn.Linear(model.classifier[3].in_features, 2)

# Load the trained weights
print("Loading trained weights...")
model.load_state_dict(checkpoint['model_state_dict'])
model.eval()

print("Creating dummy input...")
dummy_input = torch.randn(1, 3, 224, 224)

print("Exporting to ONNX (single file without external data)...")
torch.onnx.export(
    model,
    dummy_input,
    "pothole_classifier_mobilenetv3.onnx",
    export_params=True,
    opset_version=11,
    do_constant_folding=True,
    input_names=['input'],
    output_names=['output'],
    dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}}
)

import os
file_size = os.path.getsize("pothole_classifier_mobilenetv3.onnx")
print(f"\n✓ SUCCESS! Model exported as single ONNX file")
print(f"✓ File: pothole_classifier_mobilenetv3.onnx")
print(f"✓ Size: {file_size / (1024*1024):.2f} MB")
print(f"✓ Model validation accuracy: {checkpoint['val_acc']:.2f}%")
print(f"\n🎉 Ready to use! Just open index.html in your browser!")
print(f"   - No server needed")
print(f"   - Runs 100% client-side")
print(f"   - Model loads directly from file")
