class Tuner {
    constructor() {
        this.isRunning = false;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.a4Frequency = 440;
        this.bufferLength = 0;
        this.dataArray = null;
        this.sensitivity = 50; // 1-100, higher = more sensitive
        this.pitchHistory = [];
        this.maxPitchPoints = 200;

        this.noteNames = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];

        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.noteName = document.getElementById('noteName');
        this.frequency = document.getElementById('frequency');
        this.meterNeedle = document.getElementById('meterNeedle');
        this.centsDisplay = document.getElementById('centsDisplay');
        this.startBtn = document.getElementById('startBtn');
        this.a4Select = document.getElementById('a4Frequency');
        this.errorMessage = document.getElementById('errorMessage');
        this.volumeBar = document.getElementById('volumeBar');
        this.sensitivitySlider = document.getElementById('sensitivity');
        this.pitchCanvas = document.getElementById('pitchCanvas');
        this.pitchCtx = this.pitchCanvas ? this.pitchCanvas.getContext('2d') : null;

        // Ensure canvas has proper pixel dimensions
        if (this.pitchCanvas) {
            this.pitchCanvas.width = this.pitchCanvas.clientWidth;
            this.pitchCanvas.height = this.pitchCanvas.clientHeight;
        }
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => {
            this.toggleTuner();
        });

        this.a4Select.addEventListener('change', (e) => {
            this.a4Frequency = parseInt(e.target.value);
        });

        if (this.sensitivitySlider) {
            this.sensitivitySlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value)) {
                    this.sensitivity = Math.max(1, Math.min(100, value));
                }
            });
        }
    }

    async toggleTuner() {
        if (this.isRunning) {
            this.stop();
        } else {
            await this.start();
        }
    }

    async start() {
        try {
            this.errorMessage.classList.remove('show');
            console.log('1. Starting tuner...');

            // Check for browser support and secure context requirements
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('This browser does not support microphone access via getUserMedia.');
            }

            if (window.isSecureContext === false) {
                throw new Error('Microphone access requires HTTPS or localhost. Please open this app over HTTPS.');
            }

            console.log('2. Creating AudioContext...');

            // Create audio context
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContextClass();
            console.log('3. AudioContext state:', this.audioContext.state);

            // Resume if suspended
            if (this.audioContext.state === 'suspended') {
                console.log('4. Resuming AudioContext...');
                await this.audioContext.resume();
                console.log('5. Resumed, new state:', this.audioContext.state);
            }

            // Request mic (must be in a user gesture, which is ensured by the Start button)
            console.log('6. Requesting microphone...');
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
            console.log('7. Got stream:', stream);
            console.log('8. Audio tracks:', stream.getAudioTracks());

            if (!stream) {
                throw new Error('No microphone stream was received from the browser.');
            }

            const tracks = stream.getAudioTracks();
            if (!tracks || tracks.length === 0) {
                throw new Error('No active audio input device was found.');
            }

            console.log('9. Setting up analyser...');

            // Set up analyser
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;
            this.microphone.connect(this.analyser);

            this.bufferLength = this.analyser.fftSize;
            this.dataArray = new Float32Array(this.bufferLength);

            console.log('10. Starting tuner...');

            this.isRunning = true;
            this.startBtn.textContent = 'Stop Tuner';
            this.startBtn.classList.add('active');

            // Start detection
            this.detectPitch();

            console.log('11. Tuner started successfully!');

        } catch (err) {
            console.error('Tuner start error:', err);

            let friendlyMsg;
            switch (err && err.name) {
                case 'NotAllowedError':
                case 'PermissionDeniedError':
                    friendlyMsg = 'Microphone permission was denied. Check your browser\'s site permissions for this page.';
                    break;
                case 'NotFoundError':
                case 'DevicesNotFoundError':
                    friendlyMsg = 'No microphone was found. Please connect a mic and try again.';
                    break;
                case 'NotReadableError':
                case 'TrackStartError':
                    friendlyMsg = 'Your microphone is in use by another application. Close other apps using the mic and try again.';
                    break;
                case 'SecurityError':
                    friendlyMsg = 'Microphone access is blocked by browser security settings. Ensure you are using HTTPS or localhost and that mic access is allowed.';
                    break;
                default:
                    friendlyMsg = err && err.message
                        ? err.message
                        : 'Unable to access the microphone. Please check your device and browser settings.';
            }

            this.showError(friendlyMsg);
        }
    }

    showError(msg) {
        this.errorMessage.textContent = msg;
        this.errorMessage.classList.add('show');
    }

    stop() {
        this.isRunning = false;

        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.startBtn.textContent = 'Start Tuner';
        this.startBtn.classList.remove('active');

        // Reset display
        this.noteName.textContent = '--';
        this.frequency.textContent = '0 Hz';
        this.meterNeedle.style.left = '50%';
        this.centsDisplay.textContent = '0 cents';
        this.centsDisplay.className = 'cents-display';
        this.volumeBar.style.width = '0%';
    }

    detectPitch() {
        if (!this.isRunning) return;
        if (!this.analyser || !this.dataArray) return;

        try {
            this.analyser.getFloatTimeDomainData(this.dataArray);

            // Calculate volume (RMS)
            let sum = 0;
            let maxSample = 0;
            for (let i = 0; i < this.dataArray.length; i++) {
                const absVal = Math.abs(this.dataArray[i]);
                sum += this.dataArray[i] * this.dataArray[i];
                if (absVal > maxSample) maxSample = absVal;
            }
            const rms = Math.sqrt(sum / this.dataArray.length);
            const volumePercent = Math.min(100, rms * 300);
            this.volumeBar.style.width = volumePercent + '%';

            console.log('Volume RMS:', rms.toFixed(4), 'Max:', maxSample.toFixed(4));

            // Only try pitch detection if there's enough volume.
            // Map sensitivity (1-100) to an RMS threshold where higher sensitivity
            // means we accept quieter signals (lower threshold).
            const sensitivityNorm = this.sensitivity / 100; // 0.01 - 1
            const minThreshold = 0.002; // very sensitive
            const maxThreshold = 0.02;  // requires louder signal
            const rmsThreshold = maxThreshold - (maxThreshold - minThreshold) * sensitivityNorm;

            if (rms > rmsThreshold) {
                const frequency = this.autoCorrelate(this.dataArray, this.audioContext.sampleRate);
                console.log('Detected frequency:', frequency);

                if (frequency > 20 && frequency < 10000) {
                    this.updateDisplay(frequency);
                } else {
                    this.clearDisplay();
                }
            } else {
                this.clearDisplay();
            }
        } catch (e) {
            console.error('Detection error:', e);
        }

        requestAnimationFrame(() => this.detectPitch());
    }

    clearDisplay() {
        this.noteName.textContent = '--';
        this.frequency.textContent = '0 Hz';
        this.meterNeedle.style.left = '50%';
        this.centsDisplay.textContent = '0 cents';
        this.centsDisplay.className = 'cents-display';
        this.volumeBar.style.width = '0%';
        this.clearPitchGraph();
    }

    autoCorrelate(buffer, sampleRate) {
        const size = buffer.length;
        const maxSamples = Math.floor(size / 2);

        // Find the RMS first to check if there's signal
        let sum = 0;
        for (let i = 0; i < size; i++) {
            sum += buffer[i] * buffer[i];
        }
        const rms = Math.sqrt(sum / size);

        // If signal is too weak, return -1
        if (rms < 0.01) {
            return -1;
        }

        let bestOffset = -1;
        let bestCorrelation = 0;

        // Find best correlation offset
        for (let offset = 1; offset < maxSamples; offset++) {
            let correlation = 0;
            for (let i = 0; i < maxSamples; i++) {
                correlation += Math.abs(buffer[i] - buffer[i + offset]);
            }
            correlation = 1 - (correlation / maxSamples);

            if (correlation > bestCorrelation) {
                bestCorrelation = correlation;
                bestOffset = offset;
            }
        }

        // Only return valid frequency if correlation is strong enough
        if (bestCorrelation > 0.5 && bestOffset > 0) {
            return sampleRate / bestOffset;
        }

        return -1;
    }

    updateDisplay(frequency) {
        console.log('updateDisplay called with:', frequency);

        if (!frequency || !isFinite(frequency)) {
            this.clearDisplay();
            return;
        }

        // Calculate note
        const semitones = 12 * Math.log2(frequency / this.a4Frequency);
        const roundedSemitones = Math.round(semitones);
        const cents = Math.round((semitones - roundedSemitones) * 100);

        // Calculate note name
        let noteIndex = ((roundedSemitones % 12) + 12) % 12;
        const octave = Math.floor((roundedSemitones + 9) / 12) + 4;

        // Defensive: ensure valid index
        if (noteIndex < 0 || noteIndex >= this.noteNames.length) {
            noteIndex = 0;
        }

        let noteName = this.noteNames[noteIndex];
        if (!noteName) {
            noteName = 'A';
        }

        console.log('Note:', noteName + octave, 'Cents:', cents);

        // Update UI
        try {
            this.noteName.textContent = noteName + octave;
            const isSharp = typeof noteName === 'string' && noteName.indexOf('#') !== -1;
            this.noteName.classList.toggle('sharp', isSharp);

            this.frequency.textContent = frequency.toFixed(1) + ' Hz';
            this.centsDisplay.textContent = (cents > 0 ? '+' : '') + cents + ' cents';

            // Update meter (50% = center = in tune)
            const meterPosition = 50 + (cents / 50) * 50;
            this.meterNeedle.style.left = Math.max(0, Math.min(100, meterPosition)) + '%';

            // Update color
            this.centsDisplay.className = 'cents-display';
            if (Math.abs(cents) <= 5) {
                this.centsDisplay.classList.add('in-tune');
            } else if (cents > 0) {
                this.centsDisplay.classList.add('sharp');
            } else {
                this.centsDisplay.classList.add('flat');
            }

            // Update pitch history graph
            this.updatePitchGraph(frequency, cents);

            console.log('UI updated successfully');
        } catch (e) {
            console.error('UI update error:', e);
        }
    }

    updatePitchGraph(frequency, cents) {
        if (!this.pitchCtx || !this.pitchCanvas) return;

        // Clamp cents to a reasonable range for display
        const clampedCents = Math.max(-50, Math.min(50, cents));

        this.pitchHistory.push({ frequency, cents: clampedCents });
        if (this.pitchHistory.length > this.maxPitchPoints) {
            this.pitchHistory.shift();
        }

        const ctx = this.pitchCtx;
        const width = this.pitchCanvas.width;
        const height = this.pitchCanvas.height;

        ctx.clearRect(0, 0, width, height);

        // Draw center line (in tune)
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        if (this.pitchHistory.length < 2) return;

        // Draw cents over time
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 2;
        ctx.beginPath();

        const stepX = width / (this.maxPitchPoints - 1);
        this.pitchHistory.forEach((point, index) => {
            const x = index * stepX;
            // Map -50..50 cents to bottom..top
            const normalized = (point.cents + 50) / 100; // 0..1
            const y = height - normalized * height;
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();
    }

    clearPitchGraph() {
        if (!this.pitchCtx || !this.pitchCanvas) return;
        this.pitchHistory = [];
        this.pitchCtx.clearRect(0, 0, this.pitchCanvas.width, this.pitchCanvas.height);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new Tuner();
});
