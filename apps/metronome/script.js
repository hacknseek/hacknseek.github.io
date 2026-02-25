class Metronome {
    constructor() {
        this.isPlaying = false;
        this.bpm = 120;
        this.timeSignature = '4/4';
        this.currentBeat = 0;
        this.intervalId = null;
        this.audioContext = null;
        this.tickSound = null;
        this.accentSound = null;

        this.initializeElements();
        this.setupEventListeners();
        this.initializeAudio();
    }

    initializeElements() {
        this.bpmValue = document.getElementById('bpmValue');
        this.bpmSlider = document.getElementById('bpmSlider');
        this.bpmUp = document.getElementById('bpmUp');
        this.bpmDown = document.getElementById('bpmDown');
        this.timeSignatureSelect = document.getElementById('timeSignature');
        this.playBtn = document.getElementById('playBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.beatIndicator = document.getElementById('beatIndicator');
        this.beatDots = document.querySelectorAll('.beat-dot');
        this.presetButtons = document.querySelectorAll('.preset-btn');
    }

    setupEventListeners() {
        // BPM controls
        this.bpmSlider.addEventListener('input', (e) => {
            this.setBPM(parseInt(e.target.value));
        });

        this.bpmUp.addEventListener('click', () => {
            this.setBPM(Math.min(this.bpm + 1, 200));
        });

        this.bpmDown.addEventListener('click', () => {
            this.setBPM(Math.max(this.bpm - 1, 40));
        });

        // Playback controls
        this.playBtn.addEventListener('click', () => {
            this.togglePlayback();
        });

        this.resetBtn.addEventListener('click', () => {
            this.reset();
        });

        // Time signature
        this.timeSignatureSelect.addEventListener('change', (e) => {
            this.timeSignature = e.target.value;
            this.updateBeatDots();
        });

        // Preset buttons
        this.presetButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const bpm = parseInt(e.target.dataset.bpm);
                this.setBPM(bpm);
            });
        });

        // Tap anywhere to start/stop
        document.addEventListener('click', (e) => {
            if (e.target === document.body || e.target.classList.contains('container') || e.target.classList.contains('metronome-container')) {
                this.togglePlayback();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            switch(e.code) {
                case 'Space':
                    e.preventDefault();
                    this.togglePlayback();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.setBPM(Math.min(this.bpm + 5, 200));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.setBPM(Math.max(this.bpm - 5, 40));
                    break;
                case 'Escape':
                    this.stop();
                    break;
            }
        });
    }

    async initializeAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            await this.createSounds();
        } catch (error) {
            console.warn('Audio context not supported:', error);
        }
    }

    async createSounds() {
        if (!this.audioContext) return;

        // Create tick sound (regular beat)
        this.tickSound = this.createTone(800, 0.1, 'sine');

        // Create accent sound (first beat)
        this.accentSound = this.createTone(1200, 0.15, 'square');
    }

    createTone(frequency, duration, type = 'sine') {
        return () => {
            if (!this.audioContext) return;

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            oscillator.type = type;

            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + duration);
        };
    }

    setBPM(newBPM) {
        this.bpm = Math.max(40, Math.min(200, newBPM));
        this.bpmValue.textContent = this.bpm;
        this.bpmSlider.value = this.bpm;

        if (this.isPlaying) {
            this.stop();
            this.start();
        }
    }

    togglePlayback() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.start();
        }
    }

    start() {
        if (this.isPlaying) return;

        // Resume audio context if suspended (browser autoplay policy)
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        this.isPlaying = true;
        this.playBtn.classList.add('playing');
        this.playBtn.innerHTML = '<span class="play-icon">⏸</span>';

        const interval = 60000 / this.bpm; // Convert BPM to milliseconds
        this.intervalId = setInterval(() => {
            this.playBeat();
        }, interval);
    }

    stop() {
        if (!this.isPlaying) return;

        this.isPlaying = false;
        this.playBtn.classList.remove('playing');
        this.playBtn.innerHTML = '<span class="play-icon">▶</span>';

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    reset() {
        this.stop();
        this.currentBeat = 0;
        this.updateVisualIndicator();
        this.updateBeatDots();
    }

    playBeat() {
        const beatsPerMeasure = parseInt(this.timeSignature.split('/')[0]);

        // Play sound
        if (this.currentBeat === 0) {
            // First beat - accent
            if (this.accentSound) {
                this.accentSound();
            }
        } else {
            // Regular beat
            if (this.tickSound) {
                this.tickSound();
            }
        }

        // Update visual indicator
        this.updateVisualIndicator();
        this.updateBeatDots();

        // Move to next beat
        this.currentBeat = (this.currentBeat + 1) % beatsPerMeasure;
    }

    updateVisualIndicator() {
        // Animate the beat indicator
        this.beatIndicator.classList.add('active');
        setTimeout(() => {
            this.beatIndicator.classList.remove('active');
        }, 100);
    }

    updateBeatDots() {
        const beatsPerMeasure = parseInt(this.timeSignature.split('/')[0]);

        this.beatDots.forEach((dot, index) => {
            dot.classList.remove('active');
            if (index < beatsPerMeasure) {
                dot.style.display = 'block';
                if (index === this.currentBeat) {
                    dot.classList.add('active');
                }
            } else {
                dot.style.display = 'none';
            }
        });
    }
}

// Initialize the metronome when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const metronome = new Metronome();

    // Register service worker for PWA functionality
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('SW registered: ', registration);
                })
                .catch((registrationError) => {
                    console.log('SW registration failed: ', registrationError);
                });
        });
    }
});

// Handle app installation
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

// Handle app installed
window.addEventListener('appinstalled', (evt) => {
    console.log('App was installed.');
});
