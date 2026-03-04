// Mind Space - Interactive JavaScript
// Designed for ADHD/anxious users with gentle, non-overwhelming interactions

class MindSpace {
    constructor() {
        this.thoughts = [];
        this.isBreathing = false;
        this.sensorySettings = {
            colorIntensity: 50,
            fontSize: 16
        };

        this.init();
    }

    init() {
        this.bindElements();
        this.attachEventListeners();
        this.loadSavedSettings();
        this.startAmbientAnimations();
    }

    bindElements() {
        // Input elements
        this.thoughtInput = document.getElementById('thoughtDump');
        this.wordCount = document.getElementById('wordCount');
        this.releaseBtn = document.getElementById('releaseBtn');

        // Control elements
        this.breathingToggle = document.getElementById('breathingToggle');
        this.sensoryToggle = document.getElementById('sensoryToggle');
        this.voiceBtn = document.getElementById('voiceInput');

        // Display elements
        this.organizedSection = document.getElementById('organizedSection');
        this.breathingGuide = document.getElementById('breathingGuide');
        this.sensoryPanel = document.getElementById('sensoryPanel');

        // Category containers
        this.categories = {
            worries: document.getElementById('worriesItems'),
            tasks: document.getElementById('tasksItems'),
            ideas: document.getElementById('ideasItems'),
            feelings: document.getElementById('feelingsItems')
        };

        // Action buttons
        this.saveBtn = document.getElementById('saveBtn');
        this.clearBtn = document.getElementById('clearBtn');
    }

    attachEventListeners() {
        // Input tracking
        this.thoughtInput.addEventListener('input', () => this.updateWordCount());
        this.thoughtInput.addEventListener('keydown', (e) => this.handleKeyPress(e));

        // Main release button
        this.releaseBtn.addEventListener('click', () => this.processThoughts());

        // Control buttons
        this.breathingToggle.addEventListener('click', () => this.toggleBreathing());
        this.sensoryToggle.addEventListener('click', () => this.toggleSensoryPanel());
        this.voiceBtn.addEventListener('click', () => this.startVoiceInput());

        // Action buttons
        if (this.saveBtn) {
            this.saveBtn.addEventListener('click', () => this.saveThoughts());
        }
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => this.clearAll());
        }

        // Sensory controls
        const colorMode = document.getElementById('colorMode');
        const fontSize = document.getElementById('fontSize');

        if (colorMode) {
            colorMode.addEventListener('input', (e) => this.updateColorIntensity(e.target.value));
        }
        if (fontSize) {
            fontSize.addEventListener('input', (e) => this.updateFontSize(e.target.value));
        }
    }

    updateWordCount() {
        const text = this.thoughtInput.value.trim();
        const words = text ? text.split(/\s+/).length : 0;
        this.wordCount.textContent = `${words} word${words !== 1 ? 's' : ''}`;

        // Gentle auto-save to localStorage
        this.autoSave(text);
    }

    autoSave(text) {
        localStorage.setItem('mindspace_draft', text);
    }

    loadDraft() {
        const draft = localStorage.getItem('mindspace_draft');
        if (draft) {
            this.thoughtInput.value = draft;
            this.updateWordCount();
        }
    }

    handleKeyPress(e) {
        // Cmd/Ctrl + Enter to release thoughts
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            this.processThoughts();
        }
    }

    processThoughts() {
        const text = this.thoughtInput.value.trim();
        if (!text) {
            this.gentleNotification('Take your time. Write when you\'re ready.');
            return;
        }

        // Parse thoughts into categories
        const categorized = this.categorizeThoughts(text);

        // Display organized thoughts
        this.displayOrganized(categorized);

        // Gentle transition
        this.thoughtInput.style.opacity = '0.5';
        setTimeout(() => {
            this.thoughtInput.value = '';
            this.thoughtInput.style.opacity = '1';
            this.updateWordCount();
            localStorage.removeItem('mindspace_draft');
        }, 600);
    }

    categorizeThoughts(text) {
        // Split into sentences/thoughts
        const thoughts = text.match(/[^.!?]+[.!?]+/g) || [text];

        const categories = {
            worries: [],
            tasks: [],
            ideas: [],
            feelings: []
        };

        // Keywords for categorization (simplified for demo)
        const patterns = {
            worries: /worry|anxious|scared|afraid|nervous|stress|concern|fear|overwhelm/i,
            tasks: /need to|should|must|have to|todo|task|finish|complete|deadline/i,
            ideas: /what if|maybe|could|idea|dream|imagine|wish|hope|want to try/i,
            feelings: /feel|feeling|felt|emotion|happy|sad|angry|frustrated|excited|tired/i
        };

        thoughts.forEach(thought => {
            const trimmed = thought.trim();
            let categorized = false;

            for (const [category, pattern] of Object.entries(patterns)) {
                if (pattern.test(trimmed)) {
                    categories[category].push(trimmed);
                    categorized = true;
                    break;
                }
            }

            // Default to feelings if no pattern matches
            if (!categorized) {
                categories.feelings.push(trimmed);
            }
        });

        return categories;
    }

    displayOrganized(categorized) {
        // Show organized section
        this.organizedSection.style.display = 'block';
        this.organizedSection.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Clear previous items
        Object.values(this.categories).forEach(container => {
            container.innerHTML = '';
        });

        // Add thoughts to categories with staggered animation
        Object.entries(categorized).forEach(([category, thoughts]) => {
            const container = this.categories[category];
            thoughts.forEach((thought, index) => {
                setTimeout(() => {
                    const item = document.createElement('div');
                    item.className = 'thought-item';
                    item.textContent = thought;
                    container.appendChild(item);
                }, index * 100);
            });
        });
    }

    toggleBreathing() {
        this.isBreathing = !this.isBreathing;

        if (this.isBreathing) {
            this.breathingGuide.style.display = 'block';
            this.startBreathingExercise();
        } else {
            this.breathingGuide.style.display = 'none';
        }
    }

    startBreathingExercise() {
        const breathingText = this.breathingGuide.querySelector('.breathing-text');
        const breathingCircle = this.breathingGuide.querySelector('.breathing-circle');

        const phases = [
            { text: 'Breathe In', duration: 4000, startScale: 0.7, endScale: 1.5 },
            { text: 'Hold', duration: 2000, startScale: 1.5, endScale: 1.5 },
            { text: 'Breathe Out', duration: 4000, startScale: 1.5, endScale: 0.7 }
        ];

        let currentPhase = 0;

        const animatePhase = () => {
            if (!this.isBreathing) {
                breathingCircle.style.transform = 'scale(0.7)';
                return;
            }

            const phase = phases[currentPhase];
            breathingText.textContent = phase.text;

            // Set initial scale for this phase
            breathingCircle.style.transition = 'none';
            breathingCircle.style.transform = `scale(${phase.startScale})`;

            // Trigger the animation after a brief delay to ensure the initial scale is set
            setTimeout(() => {
                if (phase.text === 'Hold') {
                    // No animation during hold, just maintain size
                    breathingCircle.style.transition = 'none';
                } else {
                    // Animate to end scale for breathe in/out
                    breathingCircle.style.transition = `transform ${phase.duration}ms ease-in-out`;
                    breathingCircle.style.transform = `scale(${phase.endScale})`;
                }
            }, 50);

            currentPhase = (currentPhase + 1) % phases.length;
            setTimeout(animatePhase, phase.duration);
        };

        // Start with the circle at small size (empty lungs)
        breathingCircle.style.transform = 'scale(0.7)';
        setTimeout(animatePhase, 100);
    }

    toggleSensoryPanel() {
        const isVisible = this.sensoryPanel.style.display === 'block';
        this.sensoryPanel.style.display = isVisible ? 'none' : 'block';
    }

    updateColorIntensity(value) {
        this.sensorySettings.colorIntensity = value;
        const intensity = value / 100;

        // Update CSS variables for all green tones based on intensity
        const rootStyles = document.documentElement.style;

        // Calculate saturation and lightness based on intensity
        const saturation = 10 + (intensity * 25); // Range: 10% to 35% saturation
        const baseLightness = 65; // Base lightness for greens

        // Update all green color variables with dynamic HSL values
        rootStyles.setProperty('--sage', `hsl(95, ${saturation}%, ${45 + intensity * 10}%)`);
        rootStyles.setProperty('--soft-sage', `hsl(95, ${saturation - 5}%, ${55 + intensity * 10}%)`);
        rootStyles.setProperty('--muted-green', `hsl(95, ${saturation - 10}%, ${65 + intensity * 10}%)`);

        // Also update sand and other accent colors for consistency
        rootStyles.setProperty('--sand', `hsl(40, ${saturation - 5}%, ${80 + intensity * 5}%)`);
        rootStyles.setProperty('--lavender-mist', `hsl(280, ${saturation - 10}%, ${75 + intensity * 10}%)`);
        rootStyles.setProperty('--sky-blue', `hsl(210, ${saturation}%, ${70 + intensity * 10}%)`);
        rootStyles.setProperty('--peach', `hsl(30, ${saturation + 10}%, ${70 + intensity * 10}%)`);

        // Adjust ambient background opacity and intensity
        const ambientBg = document.querySelector('.ambient-bg');
        const breathingOrb = document.querySelector('.breathing-orb');

        // Stronger opacity changes for more visible effect
        ambientBg.style.opacity = 0.1 + (intensity * 0.5); // Range: 0.1 to 0.6
        breathingOrb.style.opacity = 0.1 + (intensity * 0.4); // Range: 0.1 to 0.5

        // Update the ambient background gradient with more intense greens
        ambientBg.style.background = `
            radial-gradient(ellipse at top left, hsl(95, ${saturation + 10}%, ${55 + intensity * 15}%) 0%, transparent 40%),
            radial-gradient(ellipse at bottom right, hsl(40, ${saturation}%, ${75 + intensity * 10}%) 0%, transparent 40%),
            radial-gradient(ellipse at center, var(--bg-primary) 0%, var(--bg-secondary) 100%)
        `;

        this.saveSensorySettings();
    }

    updateFontSize(value) {
        this.sensorySettings.fontSize = value;
        document.documentElement.style.fontSize = `${value}px`;
        this.saveSensorySettings();
    }

    saveSensorySettings() {
        localStorage.setItem('mindspace_sensory', JSON.stringify(this.sensorySettings));
    }

    loadSavedSettings() {
        const saved = localStorage.getItem('mindspace_sensory');
        if (saved) {
            this.sensorySettings = JSON.parse(saved);
            this.updateColorIntensity(this.sensorySettings.colorIntensity);
            this.updateFontSize(this.sensorySettings.fontSize);
        }

        // Load draft if exists
        this.loadDraft();
    }

    startVoiceInput() {
        if (!('webkitSpeechRecognition' in window)) {
            this.gentleNotification('Voice input is not available in your browser.');
            return;
        }

        const recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        this.voiceBtn.style.background = 'var(--sage)';
        this.voiceBtn.style.color = 'var(--soft-white)';

        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }

            // Append to existing text with a space
            if (this.thoughtInput.value && !this.thoughtInput.value.endsWith(' ')) {
                this.thoughtInput.value += ' ';
            }
            this.thoughtInput.value += transcript;
            this.updateWordCount();
        };

        recognition.onerror = () => {
            this.voiceBtn.style.background = '';
            this.voiceBtn.style.color = '';
            this.gentleNotification('Voice input stopped. Click again to restart.');
        };

        recognition.onend = () => {
            this.voiceBtn.style.background = '';
            this.voiceBtn.style.color = '';
        };

        recognition.start();

        // Stop after 30 seconds to prevent continuous recording
        setTimeout(() => recognition.stop(), 30000);
    }

    saveThoughts() {
        const organized = this.gatherOrganizedThoughts();
        const timestamp = new Date().toISOString();
        const saved = JSON.parse(localStorage.getItem('mindspace_history') || '[]');

        saved.push({
            timestamp,
            thoughts: organized,
            mood: this.detectMood(organized)
        });

        // Keep only last 50 entries
        if (saved.length > 50) {
            saved.shift();
        }

        localStorage.setItem('mindspace_history', JSON.stringify(saved));
        this.gentleNotification('Your thoughts have been safely saved.');
    }

    gatherOrganizedThoughts() {
        const organized = {};
        Object.entries(this.categories).forEach(([category, container]) => {
            const items = container.querySelectorAll('.thought-item');
            organized[category] = Array.from(items).map(item => item.textContent);
        });
        return organized;
    }

    detectMood(thoughts) {
        // Simple mood detection based on thought categories
        const totalThoughts = Object.values(thoughts).flat().length;
        const worriesCount = thoughts.worries?.length || 0;
        const ideasCount = thoughts.ideas?.length || 0;

        if (worriesCount > totalThoughts * 0.5) return 'anxious';
        if (ideasCount > totalThoughts * 0.5) return 'creative';
        return 'balanced';
    }

    clearAll() {
        // Gentle fade out animation
        Object.values(this.categories).forEach(container => {
            container.style.opacity = '0';
            setTimeout(() => {
                container.innerHTML = '';
                container.style.opacity = '1';
            }, 300);
        });

        setTimeout(() => {
            this.organizedSection.style.display = 'none';
            this.thoughtInput.focus();
        }, 600);

        this.gentleNotification('Fresh start. Your mind is clear.');
    }

    gentleNotification(message) {
        // Create a gentle, non-intrusive notification
        const notification = document.createElement('div');
        notification.className = 'gentle-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            bottom: 2rem;
            left: 50%;
            transform: translateX(-50%);
            background: var(--sage);
            color: var(--soft-white);
            padding: 1rem 2rem;
            border-radius: var(--border-radius);
            font-family: var(--font-mono);
            font-size: 0.9rem;
            opacity: 0;
            transition: opacity 0.3s;
            z-index: 1000;
        `;

        document.body.appendChild(notification);

        setTimeout(() => notification.style.opacity = '0.9', 100);
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    startAmbientAnimations() {
        // Subtle cursor following effect for the breathing orb
        let mouseX = 0, mouseY = 0;
        let orbX = 0, orbY = 0;
        const orb = document.querySelector('.breathing-orb');

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX / window.innerWidth - 0.5;
            mouseY = e.clientY / window.innerHeight - 0.5;
        });

        const animateOrb = () => {
            orbX += (mouseX - orbX) * 0.02;
            orbY += (mouseY - orbY) * 0.02;

            if (orb) {
                orb.style.transform = `translate(${orbX * 50}px, ${orbY * 50}px)`;
            }

            requestAnimationFrame(animateOrb);
        };

        animateOrb();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.mindSpace = new MindSpace();
});