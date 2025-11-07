// ==================== State Management ====================
const AppState = {
    camera: {
        stream: null,
        isActive: false
    },
    permissions: {
        camera: false,
        location: false
    },
    capture: {
        imageData: null,
        blob: null,
        timestamp: null,
        location: null
    },
    currentView: 'camera'
};

// ==================== DOM Elements ====================
const Elements = {
    // Views
    cameraView: document.getElementById('cameraView'),
    previewView: document.getElementById('previewView'),
    successView: document.getElementById('successView'),
    errorModal: document.getElementById('errorModal'),

    // Camera
    cameraStream: document.getElementById('cameraStream'),
    captureCanvas: document.getElementById('captureCanvas'),
    captureBtn: document.getElementById('captureBtn'),
    cameraStatus: document.getElementById('cameraStatus'),

    // Preview
    capturedImage: document.getElementById('capturedImage'),
    backBtn: document.getElementById('backBtn'),
    retakeBtn: document.getElementById('retakeBtn'),
    submitBtn: document.getElementById('submitBtn'),

    // Metadata displays
    locationDisplay: document.getElementById('locationDisplay'),
    coordinatesDisplay: document.getElementById('coordinatesDisplay'),
    timestampDisplay: document.getElementById('timestampDisplay'),
    accuracyDisplay: document.getElementById('accuracyDisplay'),
    confidenceScore: document.getElementById('confidenceScore'),

    // Success
    reportId: document.getElementById('reportId'),
    newReportBtn: document.getElementById('newReportBtn'),

    // Error modal
    errorTitle: document.getElementById('errorTitle'),
    errorMessage: document.getElementById('errorMessage'),
    closeErrorBtn: document.getElementById('closeErrorBtn'),

    // Processing overlay
    processingOverlay: document.getElementById('processingOverlay'),
    processingTitle: document.getElementById('processingTitle'),
    processingMessage: document.getElementById('processingMessage'),
    stepCapture: document.getElementById('step-capture'),
    stepLocation: document.getElementById('step-location'),
    stepVerify: document.getElementById('step-verify')
};

// ==================== View Management ====================
function switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });

    // Show target view
    const viewMap = {
        'camera': Elements.cameraView,
        'preview': Elements.previewView,
        'success': Elements.successView
    };

    if (viewMap[viewName]) {
        viewMap[viewName].classList.add('active');
        AppState.currentView = viewName;
    }
}

// ==================== Error Handling ====================
function showError(title, message) {
    Elements.errorTitle.textContent = title;
    Elements.errorMessage.textContent = message;
    Elements.errorModal.classList.add('active');
}

function hideError() {
    Elements.errorModal.classList.remove('active');
}

// ==================== Processing Overlay Management ====================
function showProcessing() {
    Elements.processingOverlay.classList.add('active');

    // Reset all steps to initial state
    Elements.stepCapture.classList.remove('active', 'completed');
    Elements.stepLocation.classList.remove('active', 'completed');
    Elements.stepVerify.classList.remove('active', 'completed');

    // Mark capture as completed immediately
    Elements.stepCapture.classList.add('completed');
    Elements.stepCapture.querySelector('.step-icon').textContent = '✓';

    // Set location as active
    Elements.stepLocation.classList.add('active');
}

function hideProcessing() {
    Elements.processingOverlay.classList.remove('active');
}

function updateProcessingStep(step, status) {
    const stepElement = Elements[`step${step.charAt(0).toUpperCase()}${step.slice(1)}`];

    if (status === 'active') {
        stepElement.classList.add('active');
        stepElement.classList.remove('completed');
        stepElement.querySelector('.step-icon').classList.add('loading');
        stepElement.querySelector('.step-icon').textContent = '';
    } else if (status === 'completed') {
        stepElement.classList.remove('active');
        stepElement.classList.add('completed');
        stepElement.querySelector('.step-icon').classList.remove('loading');
        stepElement.querySelector('.step-icon').textContent = '✓';
    }
}

// ==================== Camera Management ====================
function updateCameraStatus(text, state = 'loading') {
    const statusIndicator = Elements.cameraStatus.querySelector('.status-indicator');
    const statusText = Elements.cameraStatus.querySelector('.status-text');

    statusIndicator.className = `status-indicator ${state}`;
    statusText.textContent = text;
}

async function initializeCamera() {
    try {
        updateCameraStatus('Requesting camera access...', 'loading');

        // Simple camera request with constraints
        const constraints = {
            video: {
                facingMode: { ideal: 'environment' }, // Back camera on mobile
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            },
            audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        AppState.camera.stream = stream;
        AppState.camera.isActive = true;
        AppState.permissions.camera = true;

        Elements.cameraStream.srcObject = stream;

        // Wait for video to be ready
        await new Promise(resolve => {
            Elements.cameraStream.onloadedmetadata = () => {
                Elements.cameraStream.play();
                resolve();
            };
        });

        updateCameraStatus('Camera ready', 'success');
        Elements.captureBtn.disabled = false;

        return true;
    } catch (error) {
        console.error('Camera initialization error:', error);
        updateCameraStatus('Camera unavailable', 'error');
        Elements.captureBtn.disabled = true;

        let errorMsg = 'Unable to access camera. ';
        if (error.name === 'NotAllowedError') {
            errorMsg += 'Please grant camera permissions in your browser settings.';
        } else if (error.name === 'NotFoundError') {
            errorMsg += 'No camera found on this device.';
        } else if (error.name === 'NotReadableError') {
            errorMsg += 'Camera is already in use. Please close other apps.';
        } else {
            errorMsg += 'Please ensure your device has a camera and try again.';
        }

        showError('Camera Access Denied', errorMsg);
        return false;
    }
}

function stopCamera() {
    if (AppState.camera.stream) {
        AppState.camera.stream.getTracks().forEach(track => track.stop());
        AppState.camera.stream = null;
        AppState.camera.isActive = false;
    }
}

// ==================== Location Services ====================
async function captureLocation() {
    console.log('Starting location capture...');

    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            console.error('Geolocation not supported');
            Elements.locationDisplay.textContent = 'Location not supported';
            Elements.coordinatesDisplay.textContent = 'Not available';
            Elements.accuracyDisplay.textContent = 'N/A';

            resolve({
                error: 'Geolocation not supported',
                latitude: null,
                longitude: null,
                accuracy: null
            });
            return;
        }

        // Update UI to show we're working on it
        Elements.locationDisplay.textContent = 'Acquiring GPS...';
        Elements.coordinatesDisplay.textContent = 'Locating...';
        Elements.accuracyDisplay.textContent = 'Calculating...';

        const options = {
            enableHighAccuracy: true,  // Use GPS if available
            timeout: 20000,             // Increased timeout for mobile
            maximumAge: 0               // Don't use cached position
        };

        console.log('Requesting geolocation with options:', options);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log('Location success:', position);

                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;
                const accuracy = position.coords.accuracy;

                // Update coordinates display
                Elements.coordinatesDisplay.textContent =
                    `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                Elements.accuracyDisplay.textContent = `±${Math.round(accuracy)}m`;
                Elements.locationDisplay.textContent = 'Location captured';

                console.log('Location captured:', { latitude, longitude, accuracy });

                resolve({
                    latitude,
                    longitude,
                    accuracy,
                    timestamp: position.timestamp
                });
            },
            (error) => {
                console.error('Geolocation error:', error);

                let errorMsg = 'Location unavailable';

                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMsg = 'Location permission denied';
                        console.error('User denied location permission');
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMsg = 'Location unavailable';
                        console.error('Location information unavailable');
                        break;
                    case error.TIMEOUT:
                        errorMsg = 'Location request timeout';
                        console.error('Location request timed out');
                        break;
                    default:
                        errorMsg = 'Location error';
                        console.error('Unknown location error');
                }

                Elements.locationDisplay.textContent = errorMsg;
                Elements.coordinatesDisplay.textContent = 'Not available';
                Elements.accuracyDisplay.textContent = 'N/A';

                resolve({
                    error: error.message,
                    latitude: null,
                    longitude: null,
                    accuracy: null
                });
            },
            options
        );
    });
}

// ==================== Image Capture ====================
async function capturePhoto() {
    if (!AppState.camera.isActive) {
        showError('Camera Error', 'Camera is not active. Please refresh the page.');
        return;
    }

    try {
        // Disable capture button during processing
        Elements.captureBtn.disabled = true;

        // Show processing overlay immediately
        showProcessing();

        const video = Elements.cameraStream;
        const canvas = Elements.captureCanvas;

        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw current frame to canvas
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to blob
        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/jpeg', 0.92);
        });

        // Get data URL for preview
        const imageData = canvas.toDataURL('image/jpeg', 0.92);

        // Capture timestamp
        const timestamp = new Date();

        console.log('Image captured, now capturing location...');

        // Capture location - this is where the delay happens on mobile
        const location = await captureLocation();

        // Mark location step as completed
        updateProcessingStep('location', 'completed');

        console.log('Location captured, now verifying with CNN...');

        // Mark verify step as active
        updateProcessingStep('verify', 'active');
        Elements.processingMessage.textContent = 'Verifying pothole detection...';

        // Simulate CNN verification (replace with actual CNN when ready)
        // Add a small delay to show the verification step
        await new Promise(resolve => setTimeout(resolve, 800));
        simulateCNNVerification();

        // Mark verify step as completed
        updateProcessingStep('verify', 'completed');
        Elements.processingMessage.textContent = 'Processing complete!';

        // Store capture data
        AppState.capture = {
            imageData,
            blob,
            timestamp,
            location
        };

        // Update preview
        Elements.capturedImage.src = imageData;

        // Update timestamp display
        Elements.timestampDisplay.textContent = formatTimestamp(timestamp);

        console.log('All processing complete, showing preview...');

        // Small delay to show all steps completed
        await new Promise(resolve => setTimeout(resolve, 400));

        // Hide processing overlay
        hideProcessing();

        // Stop camera and switch to preview
        stopCamera();
        switchView('preview');

        // Re-enable capture button
        Elements.captureBtn.disabled = false;

    } catch (error) {
        console.error('Photo capture error:', error);
        hideProcessing();
        showError('Capture Failed', 'Unable to capture photo. Please try again.');
        Elements.captureBtn.disabled = false;
    }
}

// ==================== CNN Simulation (Placeholder) ====================
function simulateCNNVerification() {
    // This is a placeholder for the actual CNN integration
    // In production, this would analyze the image and return real results

    const confidence = 85 + Math.random() * 10; // 85-95%
    Elements.confidenceScore.textContent = `${Math.round(confidence)}%`;

    // For now, always show verified
    // When CNN is integrated, this would show actual classification results
}

// ==================== Utility Functions ====================
function formatTimestamp(date) {
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    return date.toLocaleString('en-US', options);
}

function generateReportId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `CR-${timestamp}-${random}`;
}

// ==================== Report Submission ====================
async function submitReport() {
    try {
        Elements.submitBtn.disabled = true;
        Elements.submitBtn.textContent = 'Submitting...';

        // Simulate API call (replace with actual endpoint)
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Generate report ID
        const reportId = generateReportId();
        Elements.reportId.textContent = reportId;

        // In production, send data to server:
        // const formData = new FormData();
        // formData.append('image', AppState.capture.blob);
        // formData.append('timestamp', AppState.capture.timestamp.toISOString());
        // formData.append('latitude', AppState.capture.location.latitude);
        // formData.append('longitude', AppState.capture.location.longitude);
        // formData.append('accuracy', AppState.capture.location.accuracy);
        //
        // const response = await fetch('/api/reports', {
        //     method: 'POST',
        //     body: formData
        // });

        // Show success view
        switchView('success');

        Elements.submitBtn.disabled = false;
        Elements.submitBtn.textContent = 'Submit Report';

    } catch (error) {
        console.error('Report submission error:', error);
        showError('Submission Failed', 'Unable to submit report. Please check your connection and try again.');
        Elements.submitBtn.disabled = false;
        Elements.submitBtn.textContent = 'Submit Report';
    }
}

// ==================== Event Listeners ====================
Elements.captureBtn.addEventListener('click', capturePhoto);

Elements.backBtn.addEventListener('click', () => {
    switchView('camera');
    initializeCamera();
});

Elements.retakeBtn.addEventListener('click', () => {
    switchView('camera');
    initializeCamera();
});

Elements.submitBtn.addEventListener('click', submitReport);

Elements.newReportBtn.addEventListener('click', () => {
    switchView('camera');
    initializeCamera();
});

Elements.closeErrorBtn.addEventListener('click', hideError);

// Close error modal when clicking outside
Elements.errorModal.addEventListener('click', (e) => {
    if (e.target === Elements.errorModal) {
        hideError();
    }
});

// ==================== Initialization ====================
document.addEventListener('DOMContentLoaded', async () => {
    // Check for required APIs
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showError(
            'Browser Not Supported',
            'Your browser does not support camera access. Please use a modern browser like Chrome, Safari, or Firefox.'
        );
        return;
    }

    // Initialize camera on load
    await initializeCamera();
});

// ==================== Cleanup ====================
window.addEventListener('beforeunload', () => {
    stopCamera();
});

// Handle visibility change (pause camera when tab is hidden)
document.addEventListener('visibilitychange', () => {
    if (document.hidden && AppState.currentView === 'camera') {
        stopCamera();
    } else if (!document.hidden && AppState.currentView === 'camera') {
        initializeCamera();
    }
});
