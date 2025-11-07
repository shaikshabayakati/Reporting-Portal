# Citizen Reporting Portal

A modern web application for reporting infrastructure issues (potholes) using real-time camera capture and GPS location tracking.

## Features

- **Camera-First Experience**: Camera opens immediately on app load
- **Dual Permission Request**: Requests both camera and location permissions upfront
- **Real-time Capture**: No uploads - photos must be taken in real-time
- **GPS Tracking**: Automatic location capture with accuracy metrics
- **AI-Ready**: Prepared for CNN model integration for pothole verification
- **Mobile-Optimized**: Works seamlessly on mobile devices with back camera support

## Deployment on Vercel

### Important: HTTPS Requirement

This app **MUST** be accessed via HTTPS for camera and location APIs to work. Vercel provides HTTPS by default.

### Steps to Deploy

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **Deploy on Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Deploy (no build configuration needed)
   - Vercel will automatically assign an HTTPS URL

3. **Access the App**
   - Always use the `https://your-app.vercel.app` URL
   - Never use HTTP or IP addresses
   - Bookmark the HTTPS URL for easy access

### Mobile Testing

When testing on mobile devices:

1. **First Visit**
   - Open the Vercel HTTPS URL on your mobile browser
   - You'll see TWO permission prompts:
     - Camera permission
     - Location permission
   - Allow both permissions

2. **If Permissions Denied**
   - Go to your browser settings
   - Find site permissions
   - Enable Camera and Location for your app URL
   - Reload the page

3. **Recommended Browsers**
   - Chrome (Android)
   - Safari (iOS)
   - Firefox (Both)

## Files

- `index.html` - Main application structure
- `styles.css` - Modern, minimal UI design
- `app.js` - Camera, location, and app logic
- `vercel.json` - Vercel deployment configuration with permission headers

## How It Works

1. **App Load**: Immediately requests camera and location permissions
2. **Camera View**: Shows live camera feed with capture frame overlay
3. **Capture**: Take photo → Location captured automatically
4. **Preview**: Review image, location data, and metadata
5. **Submit**: Send report (ready for backend integration)

## Future Integration

### CNN Model
Replace the `simulateCNNVerification()` function in `app.js:280` with your actual CNN model:

```javascript
async function verifyCNNImage(imageBlob) {
    // Load your TensorFlow.js model
    const model = await tf.loadLayersModel('path/to/model.json');

    // Process image
    const tensor = preprocessImage(imageBlob);

    // Run inference
    const prediction = model.predict(tensor);

    return prediction;
}
```

### Backend API
Uncomment and configure the API call in `app.js:324-335`:

```javascript
const formData = new FormData();
formData.append('image', AppState.capture.blob);
formData.append('timestamp', AppState.capture.timestamp.toISOString());
formData.append('latitude', AppState.capture.location.latitude);
formData.append('longitude', AppState.capture.location.longitude);

const response = await fetch('YOUR_API_ENDPOINT/reports', {
    method: 'POST',
    body: formData
});
```

## Troubleshooting

### "This app can't ask for permission" (Mobile)

**Cause**: You're accessing the app via HTTP or an insecure connection.

**Solution**:
- Always use the HTTPS Vercel URL (https://your-app.vercel.app)
- Never use IP addresses or HTTP

### Camera Access Denied

**Solution**:
1. Open browser settings
2. Go to Site Settings → Permissions
3. Find your app URL
4. Enable Camera and Location
5. Reload the page

### Location Not Available

The app will still work without location, but:
- Metadata will show "Location unavailable"
- Report can still be submitted
- Consider re-enabling location in browser settings

### Camera Already in Use

**Cause**: Another app or browser tab is using the camera.

**Solution**: Close other apps/tabs and refresh.

## Browser Support

- Chrome 63+
- Safari 11+
- Firefox 68+
- Edge 79+

## License

MIT
