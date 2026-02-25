class Tuner {
    constructor() {
        this.isRunning = false;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.a4Frequency = 440;
        this.bufferLength = 0;
        this.dataArray = null;

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
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => {
            this.toggleTuner();
        });

        this.a4Select.addEventListener('change', (e) => {
            this.a4Frequency = parseInt(e.target.value);
        });
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
            console.log('1. Creating AudioContext...');

            // Create audio context
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContextClass();
            console.log('2. AudioContext state:', this.audioContext.state);

            // Resume if suspended
            if (this.audioContext.state === 'suspended') {
                console.log('3. Resuming AudioContext...');
                await this.audioContext.resume();
                console.log('4. Resumed, new state:', this.audioContext.state);
            }

            // Request mic
            console.log('5. Requesting microphone...');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('6. Got stream:', stream);
            console.log('7. Audio tracks:', stream.getAudioTracks());

            if (!stream) {
                throw new Error('No stream received');
            }

            const tracks = stream.getAudioTracks();
            if (!tracks || tracks.length === 0) {
                throw new Error('No audio tracks');
            }

            console.log('8. Setting up analyser...');

            // Set up analyser
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;
            this.microphone.connect(this.analyser);

            this.bufferLength = this.analyser.fftSize;
            this.dataArray = new Float32Array(this.bufferLength);

            console.log('9. Starting tuner...');

            this.isRunning = true;
            this.startBtn.textContent = 'Stop Tuner';
            this.startBtn.classList.add('active');

            // Start detection
            this.detectPitch();

            console.log('10. Tuner started successfully!');

        } catch (err) {
            console.error('Tuner error at step:', err);
            this.showError(err.message || 'Unknown error: ' + err.toString());
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
            for (let i = 0; i < this.dataArray.length; i++) {
                sum += this.dataArray[i] * this.dataArray[i];
            }
            const rms = Math.sqrt(sum / this.dataArray.length);
            const volumePercent = Math.min(100, rms * 500);
            this.volumeBar.style.width = volumePercent + '%';

            const frequency = this.autoCorrelate(this.dataArray, this.audioContext.sampleRate);

            console.log('Volume:', rms, 'Frequency:', frequency);

            if (frequency > 50 && frequency < 5000) {
                this.updateDisplay(frequency);
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
    }

    autoCorrelate(buffer, sampleRate) {
        const size = buffer.length;
        const maxSamples = Math.floor(size / 2);
        let bestOffset = -1;
        let bestCorrelation = 0;
        let foundGoodCorrelation = false;
        const correlations = new Array(maxSamples);

        for (let offset = 0; offset < maxSamples; offset++) {
            let correlation = 0;
            for (let i = 0; i < maxSamples; i++) {
                correlation += Math.abs(buffer[i] - buffer[i + offset]);
            }
            correlation = 1 - (correlation / maxSamples);
            correlations[offset] = correlation;

            if (correlation > 0.9 && correlation > bestCorrelation) {
                bestCorrelation = correlation;
                bestOffset = offset;
                foundGoodCorrelation = true;
            } else if (foundGoodCorrelation) {
                const shift = (correlations[bestOffset + 1] - correlations[bestOffset - 1]) / correlations[bestOffset];
                return sampleRate / (bestOffset + (8 * shift));
            }
        }

        if (bestCorrelation > 0.01) {
            return sampleRate / bestOffset;
        }

        return -1;
    }

    updateDisplay(frequency) {
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

        // Update UI
        this.noteName.textContent = noteName + octave;
        this.noteName.classList.toggle('sharp', noteName && noteName.includes('#'));

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
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new Tuner();
});
