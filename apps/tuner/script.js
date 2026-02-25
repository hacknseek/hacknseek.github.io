class Tuner {
    constructor() {
        this.isRunning = false;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.a4Frequency = 440;
        this.bufferLength = 0;
        this.dataArray = null;

        // Musical note frequencies (A4 = 440 Hz standard)
        this.noteFrequencies = {
            'C': 261.63,
            'C#': 277.18,
            'D': 293.66,
            'D#': 311.13,
            'E': 329.63,
            'F': 349.23,
            'F#': 369.99,
            'G': 392.00,
            'G#': 415.30,
            'A': 440.00,
            'A#': 466.16,
            'B': 493.88
        };

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
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.microphone = this.audioContext.createMediaStreamSource(stream);

            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.microphone.connect(this.analyser);

            this.bufferLength = this.analyser.fftSize;
            this.dataArray = new Float32Array(this.bufferLength);

            this.isRunning = true;
            this.startBtn.textContent = 'Stop Tuner';
            this.startBtn.classList.add('active');
            this.errorMessage.classList.remove('show');

            this.detectPitch();
        } catch (error) {
            console.error('Microphone access error:', error);
            this.errorMessage.classList.add('show');
        }
    }

    stop() {
        this.isRunning = false;

        if (this.microphone) {
            this.microphone.disconnect();
        }

        if (this.audioContext) {
            this.audioContext.close();
        }

        this.startBtn.textContent = 'Start Tuner';
        this.startBtn.classList.remove('active');

        // Reset display
        this.noteName.textContent = '--';
        this.frequency.textContent = '0 Hz';
        this.meterNeedle.style.left = '50%';
        this.centsDisplay.textContent = '0 cents';
        this.centsDisplay.className = 'cents-display';
    }

    detectPitch() {
        if (!this.isRunning) return;

        this.analyser.getFloatTimeDomainData(this.dataArray);
        const frequency = this.autoCorrelate(this.dataArray, this.audioContext.sampleRate);

        if (frequency === -1) {
            // No clear pitch detected
            this.noteName.textContent = '--';
            this.frequency.textContent = '0 Hz';
            this.meterNeedle.style.left = '50%';
            this.centsDisplay.textContent = '0 cents';
            this.centsDisplay.className = 'cents-display';
        } else {
            this.updateDisplay(frequency);
        }

        requestAnimationFrame(() => this.detectPitch());
    }

    autoCorrelate(buffer, sampleRate) {
        const SIZE = buffer.length;
        const MAX_SAMPLES = Math.floor(SIZE / 2);
        let bestOffset = -1;
        let bestCorrelation = 0;
        let foundGoodCorrelation = false;
        const correlations = new Array(MAX_SAMPLES);

        // First pass: find the best correlation
        for (let offset = 0; offset < MAX_SAMPLES; offset++) {
            let correlation = 0;
            for (let i = 0; i < MAX_SAMPLES; i++) {
                correlation += Math.abs((buffer[i]) - (buffer[i + offset]));
            }
            correlation = 1 - (correlation / MAX_SAMPLES);
            correlations[offset] = correlation;

            if (correlation > 0.9 && correlation > bestCorrelation) {
                bestCorrelation = correlation;
                bestOffset = offset;
                foundGoodCorrelation = true;
            } else if (foundGoodCorrelation) {
                // Shift based on sample rate to get frequency
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
        // Calculate the closest note
        const noteInfo = this.frequencyToNote(frequency);

        this.noteName.textContent = noteInfo.note;
        if (noteInfo.sharp) {
            this.noteName.classList.add('sharp');
        } else {
            this.noteName.classList.remove('sharp');
        }

        this.frequency.textContent = `${frequency.toFixed(1)} Hz`;

        // Update cents display (-50 to +50)
        const cents = noteInfo.cents;
        this.centsDisplay.textContent = `${cents > 0 ? '+' : ''}${cents} cents`;

        // Update meter position (0% = flat, 50% = in tune, 100% = sharp)
        const meterPosition = 50 + (cents / 50) * 50;
        const clampedPosition = Math.max(0, Math.min(100, meterPosition));
        this.meterNeedle.style.left = `${clampedPosition}%`;

        // Update cents display color
        this.centsDisplay.className = 'cents-display';
        if (Math.abs(cents) <= 5) {
            this.centsDisplay.classList.add('in-tune');
        } else if (cents > 0) {
            this.centsDisplay.classList.add('sharp');
        } else {
            this.centsDisplay.classList.add('flat');
        }
    }

    frequencyToNote(frequency) {
        // Calculate the number of semitones from A4
        const semitones = 12 * Math.log2(frequency / this.a4Frequency);
        const roundedSemitones = Math.round(semitones);

        // Calculate cents deviation
        const cents = Math.round((semitones - roundedSemitones) * 100);

        // Calculate the note name
        const noteNames = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
        const octave = Math.floor((roundedSemitones + 9) / 12) + 4;
        const noteIndex = ((roundedSemitones % 12) + 12) % 12;

        return {
            note: noteNames[noteIndex] + octave,
            sharp: noteNames[noteIndex].includes('#'),
            cents: cents
        };
    }
}

// Initialize the tuner when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const tuner = new Tuner();
});
