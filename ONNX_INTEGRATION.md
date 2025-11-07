# ONNX Model Integration Guide

## Overview
The Citizen Reporting Portal now includes client-side AI-powered pothole detection using your ONNX model (`pothole_classifier_mobilenetv3.onnx`). Images are automatically verified before submission.

## How It Works

### 1. **Model Loading**
- The ONNX model is loaded automatically when the page loads
- Uses ONNX Runtime Web for browser-based inference
- Model file: `pothole_classifier_mobilenetv3.onnx`

### 2. **Image Capture & Classification Flow**
1. User captures an image using their camera
2. Image is sent to the location service for GPS coordinates
3. **Image is preprocessed and classified by the ONNX model**
4. Model returns:
   - `isPothole`: boolean (true/false)
   - `confidence`: float (0.0 to 1.0)

### 3. **Image Preprocessing**
- Images are resized to 224x224 pixels (MobileNetV3 standard input)
- Converted from RGBA to RGB
- Normalized to [0, 1] range
- Formatted as Float32Array with shape `[1, 3, 224, 224]`
- Channel order: RGB (Red, Green, Blue)

### 4. **Classification Logic**
The model output is interpreted as follows:
- **If 2 outputs**: Assumes binary classification [not_pothole, pothole], applies softmax
- **If 1 output**: Assumes sigmoid output
- **If multiple outputs**: Applies softmax and uses index 1 as pothole class
- **Threshold**: 0.5 (configurable in code)

### 5. **UI Response**

#### ✅ **Pothole Detected (Verified)**
- Green verification panel
- Checkmark icon
- "Image Verified" message
- Submit button is **ENABLED**
- Confidence score displayed

#### ❌ **No Pothole Detected (Rejected)**
- Red verification panel
- X icon
- "Image Not Verified" message
- Submit button is **DISABLED**
- User must retake the photo

## Files Modified

### 1. `index.html`
- Added ONNX Runtime Web CDN script
- Added IDs to verification panel elements for dynamic updates

### 2. `app.js`
- Added ONNX model state management
- Implemented `loadONNXModel()` function
- Implemented `preprocessImage()` function for image normalization
- Implemented `classifyImage()` function for model inference
- Updated `capturePhoto()` to use real ONNX classification
- Added `updateVerificationUI()` to show verification status
- Added validation in `submitReport()` to prevent non-pothole submissions

### 3. `styles.css`
- Added `.verified` and `.rejected` states for verification panel
- Added styling for disabled submit button
- Added color transitions for verification states

## Configuration

### Adjusting Classification Threshold
In `app.js`, locate this line in the `classifyImage()` function:

```javascript
const threshold = 0.5; // Adjust this value (0.0 to 1.0)
```

- **Lower threshold** (e.g., 0.3): More permissive, may allow false positives
- **Higher threshold** (e.g., 0.7): More strict, may reject some valid potholes

### Model Input Requirements
Current preprocessing assumes:
- Input size: 224x224
- Color format: RGB
- Value range: [0, 1]
- Shape: `[1, 3, 224, 224]` (batch, channels, height, width)

**If your model expects different preprocessing**, modify the `preprocessImage()` function:
- Change `targetSize` for different input dimensions
- Adjust normalization (currently dividing by 255)
- Modify channel ordering if needed

### Model Output Interpretation
If your model output format differs, modify the `classifyImage()` function:
- Adjust the confidence extraction logic
- Change the class index if pothole is not at index 1
- Modify softmax/sigmoid interpretation

## Testing

### Test Cases to Verify:

1. **Pothole Image**
   - Capture image of an actual pothole
   - Should show green verification
   - Submit button should be enabled

2. **Non-Pothole Image**
   - Capture image of regular road, grass, etc.
   - Should show red rejection
   - Submit button should be disabled
   - Should display "Cannot Submit" message

3. **Model Loading**
   - Check browser console for "ONNX model loaded successfully"
   - Verify no errors during model initialization

## Browser Compatibility

### Supported Browsers:
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (iOS 16+)

### Requirements:
- WebAssembly support
- Camera access permissions
- Modern JavaScript (ES6+)

## Troubleshooting

### Model Not Loading
**Issue**: Console shows "Failed to load ONNX model"

**Solutions**:
1. Verify `pothole_classifier_mobilenetv3.onnx` is in the same directory as `index.html`
2. Check file permissions
3. Ensure the file is a valid ONNX model
4. Check browser console for specific error messages

### Incorrect Classifications
**Issue**: Model always returns same result

**Solutions**:
1. Verify preprocessing matches training preprocessing
2. Check model input/output shapes in console logs
3. Adjust threshold value
4. Test model with known pothole/non-pothole images

### Submit Button Always Disabled
**Issue**: Button won't enable even for potholes

**Solutions**:
1. Check browser console for classification results
2. Verify `confidence` value is above threshold
3. Lower the threshold temporarily for testing
4. Ensure `isPothole` is being set correctly

## API Integration

When connecting to a backend, the capture data includes:

```javascript
{
    image: blob,                    // JPEG image file
    timestamp: ISO8601 string,      // Capture time
    latitude: float,                // GPS latitude
    longitude: float,               // GPS longitude
    accuracy: float,                // GPS accuracy in meters
    confidence: float,              // Model confidence (0-1)
    isPothole: boolean             // Classification result
}
```

Send this data to your backend endpoint in `submitReport()` function.

## Performance

- **Model size**: Depends on your MobileNetV3 variant
- **Inference time**: Typically 100-500ms on modern devices
- **Memory usage**: ~50-100MB for model + runtime
- **Network**: Model loaded once, then cached

## Security Notes

1. All processing happens client-side (no data sent to external servers)
2. Images are not stored unless explicitly saved by backend
3. GPS data requires user permission
4. Camera access requires user permission

## Next Steps

1. Test with various pothole images
2. Adjust threshold based on real-world performance
3. Connect to backend API for report storage
4. Consider adding confidence level warnings (e.g., "Low confidence - please retake")
5. Add analytics to track classification accuracy

## Support

For issues with:
- **ONNX model**: Verify model architecture and preprocessing
- **Camera/GPS**: Check browser permissions
- **UI/UX**: Review console logs for errors

---

**Note**: The model runs entirely in the browser using ONNX Runtime Web, providing instant feedback without server round-trips.
