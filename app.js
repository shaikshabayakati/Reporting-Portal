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
    closeErrorBtn: document.getElementById('closeErrorBtn')
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
let errorCallback = null;

function showError(title, message, callback = null) {
    Elements.errorTitle.textContent = title;
    Elements.errorMessage.textContent = message;
    Elements.errorModal.classList.add('active');
    errorCallback = callback;
}

function hideError() {
    Elements.errorModal.classList.remove('active');
    if (errorCallback) {
        errorCallback();
        errorCallback = null;
    }
}

// ==================== Permission Management ====================
async function requestLocationPermission() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported by your browser'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                AppState.permissions.location = true;
                resolve(position);
            },
            (error) => {
                console.error('Location permission error:', error);
                let errorMsg = '';
                
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMsg = 'Location access is REQUIRED to use this app. Please allow location access when prompted.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMsg = 'Location information is unavailable. Please enable location services on your device.';
                        break;
                    case error.TIMEOUT:
                        errorMsg = 'Location request timed out. Please try again.';
                        break;
                    default:
                        errorMsg = 'An unknown error occurred while requesting location.';
                }
                
                reject(new Error(errorMsg));
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            }
        );
    });
}

async function requestPermissions() {
    try {
        updateCameraStatus('Requesting permissions...', 'loading');

        // Check if we're on HTTPS or localhost
        const isSecureContext = window.isSecureContext;
        if (!isSecureContext) {
            throw new Error('This app requires HTTPS to access camera and location.');
        }

        // Request location permission FIRST and make it mandatory
        let locationResult = null;
        while (!AppState.permissions.location) {
            try {
                updateCameraStatus('Location permission required...', 'loading');
                locationResult = await requestLocationPermission();
                // If we get here, location permission was granted
                break;
            } catch (error) {
                console.error('Location permission denied:', error);
                
                // Show error and ask again
                await new Promise((resolve) => {
                    showError(
                        'Location Permission Required',
                        error.message + ' The app cannot function without location access. Click OK to try again.',
                        () => {
                            hideError();
                            resolve();
                        }
                    );
                });
                
                // Loop will continue and ask again
            }
        }

        // Only proceed to camera after location is granted
        updateCameraStatus('Requesting camera access...', 'loading');

        // Request Camera Permission
        let cameraStream = null;
        try {
            const constraints = {
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            };
            cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            AppState.permissions.camera = true;
        } catch (error) {
            console.error('Camera permission error:', error);
            throw error;
        }

        return { cameraStream, locationResult };

    } catch (error) {
        console.error('Permission request error:', error);

        let errorMsg = '';
        let errorTitle = 'Permission Required';

        if (error.message.includes('HTTPS')) {
            errorTitle = 'Insecure Connection';
            errorMsg = 'This app must be accessed via HTTPS. Please use your Vercel deployment URL (https://...) instead of HTTP.';
        } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMsg = 'Camera access was denied. Please enable camera permissions in your browser settings and reload the page.';
        } else if (error.name === 'NotFoundError') {
            errorMsg = 'No camera found on this device. Please ensure your device has a camera.';
        } else if (error.name === 'NotReadableError') {
            errorMsg = 'Camera is already in use by another application. Please close other apps and try again.';
        } else {
            errorMsg = `Unable to access required permissions: ${error.message}. Please check your browser settings.`;
        }

        showError(errorTitle, errorMsg);
        throw error;
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
        // If we already have camera permission and stream, just restart it
        if (AppState.permissions.camera && AppState.camera.stream) {
            Elements.cameraStream.srcObject = AppState.camera.stream;
            AppState.camera.isActive = true;

            await new Promise(resolve => {
                Elements.cameraStream.onloadedmetadata = () => {
                    Elements.cameraStream.play();
                    resolve();
                };
            });

            updateCameraStatus('Camera ready', 'success');
            Elements.captureBtn.disabled = false;
            return true;
        }

        // Request permissions if not already granted
        const { cameraStream, locationResult } = await requestPermissions();

        AppState.camera.stream = cameraStream;
        AppState.camera.isActive = true;

        Elements.cameraStream.srcObject = cameraStream;

        // Wait for video to be ready
        await new Promise(resolve => {
            Elements.cameraStream.onloadedmetadata = () => {
                Elements.cameraStream.play();
                resolve();
            };
        });

        // Both permissions are now mandatory, so we always have location
        updateCameraStatus('All permissions granted', 'success');

        Elements.captureBtn.disabled = false;

        return true;
    } catch (error) {
        console.error('Camera initialization error:', error);
        updateCameraStatus('Permissions denied', 'error');
        Elements.captureBtn.disabled = true;
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
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve({
                error: 'Geolocation not supported',
                latitude: null,
                longitude: null,
                accuracy: null
            });
            return;
        }

        Elements.locationDisplay.textContent = 'Acquiring GPS...';
        Elements.coordinatesDisplay.textContent = 'Locating...';
        Elements.accuracyDisplay.textContent = 'Calculating...';

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;
                const accuracy = position.coords.accuracy;

                // Update coordinates display
                Elements.coordinatesDisplay.textContent =
                    `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                Elements.accuracyDisplay.textContent = `±${Math.round(accuracy)}m`;

                // Reverse geocoding (placeholder - would need actual API)
                Elements.locationDisplay.textContent = 'Location captured';

                resolve({
                    latitude,
                    longitude,
                    accuracy,
                    timestamp: position.timestamp
                });
            },
            (error) => {
                console.error('Geolocation error:', error);
                Elements.locationDisplay.textContent = 'Location unavailable';
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

        // Capture location
        const location = await captureLocation();

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

        // Simulate CNN verification (placeholder)
        simulateCNNVerification();

        // Stop camera and switch to preview
        stopCamera();
        switchView('preview');

    } catch (error) {
        console.error('Photo capture error:', error);
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
