// ===== STATE MANAGEMENT =====
let options = ['Pizza', 'Sushi', 'Hamburguesa'];
let isSpinning = false;
let currentRotation = 0;
let soundEnabled = true;
let currentTheme = 'dark';

// ===== FLAPPY BIRD STATE =====
const FLAPPY_CANVAS_WIDTH = 400;
const FLAPPY_CANVAS_HEIGHT = 600;
const BIRD_SIZE = 30;
const PIPE_WIDTH = 60;
const PIPE_GAP = 150;
const GRAVITY = 0.5;
const JUMP_STRENGTH = -9;
const PIPE_SPEED = 3;

let bird = { x: 100, y: 300, velocity: 0 };
let pipes = [];
let flappyScore = 0;
let flappyHighScore = 0;
let flappyGameLoop = null;
let isFlappyRunning = false;
let isFlappyPaused = false;
let frameCount = 0;
let selectedCharacter = 'duck';
let charImage = new Image();
charImage.src = 'fran.png';

// ===== AUDIO CONTEXT =====
let audioContext = null;
let spinSound = null;
let winSound = null;

// Initialize Audio Context (lazy loading)
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Create spinning sound (continuous tone that changes pitch)
function playSpinSound() {
    if (!soundEnabled) return;
    initAudio();

    if (spinSound) {
        spinSound.stop();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 4);

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 4);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 4);

    spinSound = oscillator;
}

// Create winner sound (celebratory beeps)
function playWinSound() {
    if (!soundEnabled) return;
    initAudio();

    const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C, E, G, C (major chord)

    frequencies.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);

        const startTime = audioContext.currentTime + (index * 0.15);
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.2, startTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

        oscillator.start(startTime);
        oscillator.stop(startTime + 0.3);
    });
}

// ===== COLOR PALETTE =====
const vibrantColors = [
    '#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#FF8B94',
    '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3', '#A8D8EA',
    '#FFD93D', '#6BCF7F', '#FF6F91', '#C7CEEA', '#FFEAA7'
];

// ===== DOM ELEMENTS =====
const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');
const spinBtn = document.getElementById('spinBtn');
const optionInput = document.getElementById('optionInput');
const addOptionBtn = document.getElementById('addOptionBtn');
const optionsList = document.getElementById('optionsList');
const optionCount = document.getElementById('optionCount');
const clearAllBtn = document.getElementById('clearAllBtn');
const winnerModal = document.getElementById('winnerModal');
const winnerText = document.getElementById('winnerText');
const closeModalBtn = document.getElementById('closeModalBtn');
const spinAgainBtn = document.getElementById('spinAgainBtn');
const confettiContainer = document.getElementById('confettiContainer');
const themeBtn = document.getElementById('themeBtn');
const themeDropdown = document.getElementById('themeDropdown');
const soundBtn = document.getElementById('soundBtn');
const soundIcon = document.getElementById('soundIcon');

// Navigation elements
const navBtns = document.querySelectorAll('.nav-btn');
const modeSections = document.querySelectorAll('.mode-section');

// Flappy Bird elements
const flappyCanvas = document.getElementById('flappyCanvas');
const flappyCtx = flappyCanvas ? flappyCanvas.getContext('2d') : null;
const flappyScoreEl = document.getElementById('flappyScore');
const flappyHighScoreEl = document.getElementById('flappyHighScore');
const flappyOverlay = document.getElementById('flappyOverlay');
const startFlappyBtn = document.getElementById('startFlappyBtn');
const flappyPauseBtn = document.getElementById('flappyPauseBtn');
const flappyRestartBtn = document.getElementById('flappyRestartBtn');
const flappyGameOverModal = document.getElementById('flappyGameOverModal');
const flappyFinalScore = document.getElementById('flappyFinalScore');
const flappyNewRecordLabel = document.getElementById('flappyNewRecordLabel');
const flappyPlayAgainBtn = document.getElementById('flappyPlayAgainBtn');
const flappyBackToMenuBtn = document.getElementById('flappyBackToMenuBtn');
const tapButton = document.getElementById('tapButton');

// ===== INITIALIZATION =====
function init() {
    loadTheme();
    loadSoundPreference();
    loadFlappyHighScore();
    drawWheel();
    updateOptionsList();
    updateOptionCount();
    attachEventListeners();
    initNavigation();
}

// ===== EVENT LISTENERS =====
function attachEventListeners() {
    spinBtn.addEventListener('click', spinWheel);
    addOptionBtn.addEventListener('click', addOption);
    optionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addOption();
    });
    clearAllBtn.addEventListener('click', clearAllOptions);
    closeModalBtn.addEventListener('click', closeModal);
    spinAgainBtn.addEventListener('click', () => {
        closeModal();
        setTimeout(() => spinWheel(), 300);
    });

    // Theme controls
    themeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        themeDropdown.classList.toggle('active');
    });

    document.addEventListener('click', () => {
        themeDropdown.classList.remove('active');
    });

    document.querySelectorAll('.theme-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const theme = btn.dataset.theme;
            setTheme(theme);
            themeDropdown.classList.remove('active');
        });
    });

    // Sound toggle
    soundBtn.addEventListener('click', toggleSound);

    // Flappy Bird controls
    if (startFlappyBtn) startFlappyBtn.addEventListener('click', startFlappyGame);
    if (flappyPauseBtn) flappyPauseBtn.addEventListener('click', toggleFlappyPause);
    if (flappyRestartBtn) flappyRestartBtn.addEventListener('click', resetFlappyGame);
    if (flappyPlayAgainBtn) flappyPlayAgainBtn.addEventListener('click', () => {
        flappyGameOverModal.classList.remove('active');
        resetFlappyGame();
        startFlappyGame();
    });
    if (flappyBackToMenuBtn) flappyBackToMenuBtn.addEventListener('click', () => {
        flappyGameOverModal.classList.remove('active');
        switchMode('menu');
    });

    const flappyCloseX = document.getElementById('flappyCloseX');
    if (flappyCloseX) {
        flappyCloseX.addEventListener('click', () => {
            flappyGameOverModal.classList.remove('active');
        });
    }

    // Flappy jump controls
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && isFlappyRunning && !isFlappyPaused) {
            e.preventDefault();
            flappyJump();
        }
    });

    if (flappyCanvas) {
        flappyCanvas.addEventListener('click', () => {
            if (isFlappyRunning && !isFlappyPaused) {
                flappyJump();
            }
        });
    }

    if (tapButton) {
        tapButton.addEventListener('click', () => {
            if (isFlappyRunning && !isFlappyPaused) {
                flappyJump();
            }
        });
    }


    // Character Selection
    const charOptions = document.querySelectorAll('.character-option');
    charOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            // Remove selected class from all
            charOptions.forEach(o => o.classList.remove('selected'));
            // Add to clicked
            opt.classList.add('selected');
            // Update state
            selectedCharacter = opt.dataset.char;
        });
    });

    // Menu cards listeners
    const cards = document.querySelectorAll('.menu-card');
    console.log("Found menu cards:", cards.length); // Debug
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const mode = card.dataset.mode;
            console.log("Card clicked:", mode); // Debug
            if (mode) switchMode(mode);
        });
    });
}

// ===== OPTION MANAGEMENT =====
function addOption() {
    const text = optionInput.value.trim();

    if (!text) {
        shakeElement(optionInput);
        return;
    }

    if (options.length >= 15) {
        alert('¡Máximo 15 opciones permitidas!');
        return;
    }

    options.push(text);
    optionInput.value = '';
    updateOptionsList();
    updateOptionCount();
    drawWheel();

    // Focus back on input for quick adding
    optionInput.focus();
}

function deleteOption(index) {
    if (options.length <= 2) {
        alert('¡Necesitas al menos 2 opciones para girar la ruleta!');
        return;
    }

    options.splice(index, 1);
    updateOptionsList();
    updateOptionCount();
    drawWheel();
}

function clearAllOptions() {
    if (confirm('¿Estás seguro de que quieres eliminar todas las opciones?')) {
        options = [];
        updateOptionsList();
        updateOptionCount();
        drawWheel();
    }
}

function updateOptionsList() {
    optionsList.innerHTML = '';

    options.forEach((option, index) => {
        const li = document.createElement('li');
        li.className = 'option-item';
        li.dataset.index = index;

        const color = vibrantColors[index % vibrantColors.length];

        li.innerHTML = `
            <span class="option-color" style="background: ${color};"></span>
            <span class="option-text">${option}</span>
            <button class="btn-delete" data-index="${index}">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
        `;

        const deleteBtn = li.querySelector('.btn-delete');
        deleteBtn.addEventListener('click', () => deleteOption(index));

        optionsList.appendChild(li);
    });
}

function updateOptionCount() {
    const count = options.length;
    optionCount.textContent = `${count} ${count === 1 ? 'opción' : 'opciones'}`;
}

// ===== WHEEL DRAWING =====
function drawWheel() {
    if (!ctx || options.length === 0) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10;
        drawEmptyWheel(centerX, centerY, radius);
        return;
    }

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;
    const anglePerSegment = (2 * Math.PI) / options.length;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save context state
    ctx.save();

    // Apply rotation
    ctx.translate(centerX, centerY);
    ctx.rotate((currentRotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);

    // Draw segments
    options.forEach((option, index) => {
        const startAngle = index * anglePerSegment - Math.PI / 2;
        const endAngle = startAngle + anglePerSegment;
        const color = vibrantColors[index % vibrantColors.length];

        // Draw segment
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        // Draw border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw text
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + anglePerSegment / 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Poppins';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        // Truncate long text
        let displayText = option;
        if (displayText.length > 12) {
            displayText = displayText.substring(0, 12) + '...';
        }

        ctx.fillText(displayText, radius * 0.65, 5);
        ctx.restore();
    });

    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 60, 0, 2 * Math.PI);
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 60);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Restore context state
    ctx.restore();
}

function drawEmptyWheel(centerX, centerY, radius) {
    // Draw gray circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw message
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = 'bold 20px Poppins';
    ctx.textAlign = 'center';
    ctx.fillText('Añade opciones', centerX, centerY - 10);
    ctx.fillText('para comenzar', centerX, centerY + 20);
}

// ===== WHEEL SPINNING =====
function spinWheel() {
    if (isSpinning) return;

    if (options.length < 2) {
        alert('¡Necesitas al menos 2 opciones para girar la ruleta!');
        shakeElement(optionsList);
        return;
    }

    isSpinning = true;
    spinBtn.disabled = true;

    // Play spin sound
    playSpinSound();

    // Random spin parameters
    const minSpins = 5;
    const maxSpins = 8;
    const spins = minSpins + Math.random() * (maxSpins - minSpins);
    const totalRotation = spins * 360 + Math.random() * 360;

    // Animation parameters
    const duration = 4000; // 4 seconds
    const startTime = Date.now();
    const startRotation = currentRotation;

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out cubic)
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        currentRotation = startRotation + totalRotation * easeProgress;
        drawWheel();

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Normalize rotation
            currentRotation = currentRotation % 360;

            // Calculate winner
            const winner = calculateWinner();
            showWinner(winner);

            isSpinning = false;
            spinBtn.disabled = false;
        }
    }

    animate();
}

function calculateWinner() {
    // The pointer is at the top, so we need to find which segment is at 90 degrees
    const normalizedRotation = (360 - (currentRotation % 360)) % 360;
    const anglePerOption = 360 / options.length;
    const winnerIndex = Math.floor(normalizedRotation / anglePerOption);

    return options[winnerIndex];
}

// ===== MODAL & CONFETTI =====
function showWinner(winner) {
    winnerText.textContent = winner;
    winnerModal.classList.add('active');
    createConfetti();
    playWinSound();
}

function closeModal() {
    winnerModal.classList.remove('active');
    confettiContainer.innerHTML = '';
}

function createConfetti() {
    const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#FF8B94', '#95E1D3'];
    const confettiCount = 50;

    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
        confettiContainer.appendChild(confetti);
    }
}

// ===== UTILITY FUNCTIONS =====
function shakeElement(element) {
    element.classList.add('shake');
    setTimeout(() => element.classList.remove('shake'), 500);
}

// Add shake animation to CSS dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        75% { transform: translateX(10px); }
    }
    .shake {
        animation: shake 0.3s ease-in-out;
    }
`;
document.head.appendChild(style);

// ===== THEME MANAGEMENT =====
function setTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('wheelTheme', theme);

    // Update active state
    document.querySelectorAll('.theme-option').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.theme === theme) {
            btn.classList.add('active');
        }
    });

    // Redraw wheel with new theme
    drawWheel();
}

function loadTheme() {
    const savedTheme = localStorage.getItem('wheelTheme') || 'dark';
    setTheme(savedTheme);
}

// ===== SOUND MANAGEMENT =====
function toggleSound() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('wheelSound', soundEnabled);
    updateSoundIcon();

    // Play a test sound when enabling
    if (soundEnabled) {
        initAudio();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.2);
    }
}

function updateSoundIcon() {
    if (soundEnabled) {
        soundIcon.innerHTML = `
            <path d="M9 4L5 8H2V12H5L9 16V4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M15.54 8.46C16.4774 9.39764 17.004 10.6692 17.004 11.995C17.004 13.3208 16.4774 14.5924 15.54 15.53" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        `;
        soundBtn.style.opacity = '1';
    } else {
        soundIcon.innerHTML = `
            <path d="M9 4L5 8H2V12H5L9 16V4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="16" y1="8" x2="20" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <line x1="20" y1="8" x2="16" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        `;
        soundBtn.style.opacity = '0.5';
    }
}

function loadSoundPreference() {
    const savedSound = localStorage.getItem('wheelSound');
    soundEnabled = savedSound === null ? true : savedSound === 'true';
    updateSoundIcon();
}

// ===== NAVIGATION SYSTEM =====
function initNavigation() {
    const brandBtn = document.querySelector('.navbar-brand');
    if (brandBtn) {
        brandBtn.style.cursor = 'pointer';
        brandBtn.addEventListener('click', () => switchMode('menu'));
    }

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            switchMode(mode);
        });
    });
}

function switchMode(mode) {
    console.log("Switching to mode:", mode); // Debug log

    // Hide all sections
    modeSections.forEach(section => {
        section.classList.remove('active');
        // Check if this section matches the mode
        if (section.id === `${mode}Section`) {
            section.classList.add('active');
        } else if (mode === 'menu' && section.id === 'menuSection') {
            section.classList.add('active');
        }
    });

    // Update nav buttons
    navBtns.forEach(btn => {
        if (btn.dataset.mode === mode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Valid modes check (optional, but good for safety)
    const validModes = ['wheel', 'flappy', 'motivacion', 'clicker', 'menu'];
    if (!validModes.includes(mode)) {
        console.warn("Unknown mode:", mode);
        return;
    }

    // Pause flappy if leaving flappy section
    if (mode !== 'flappy' && isFlappyRunning) {
        pauseFlappyGame();
    }
}

// ===== FLAPPY BIRD GAME LOGIC =====
function initFlappyBird() {
    bird = { x: 100, y: 300, velocity: 0 };
    pipes = [];
    flappyScore = 0;
    frameCount = 0;
    updateFlappyScore();

    // Create initial pipes
    pipes.push(createPipe(FLAPPY_CANVAS_WIDTH));
    pipes.push(createPipe(FLAPPY_CANVAS_WIDTH + 250));
}

function createPipe(x) {
    const minHeight = 100;
    const maxHeight = FLAPPY_CANVAS_HEIGHT - PIPE_GAP - minHeight;
    const topHeight = Math.floor(Math.random() * (maxHeight - minHeight)) + minHeight;

    return {
        x: x,
        topHeight: topHeight,
        bottomY: topHeight + PIPE_GAP,
        passed: false
    };
}

function startFlappyGame() {
    if (isFlappyRunning) return;

    initFlappyBird();
    flappyOverlay.classList.add('hidden');
    isFlappyRunning = true;
    isFlappyPaused = false;
    flappyGameLoop = requestAnimationFrame(updateFlappyGame);
}

function stopFlappyGame() {
    isFlappyRunning = false;
    isFlappyPaused = false;
    if (flappyGameLoop) {
        cancelAnimationFrame(flappyGameLoop);
        flappyGameLoop = null;
    }
}

function flappyGameOver() {
    console.log('🎮 flappyGameOver called!');
    console.log('Modal element:', flappyGameOverModal);
    stopFlappyGame();

    // Update high score
    if (flappyScore > flappyHighScore) {
        flappyHighScore = flappyScore;
        localStorage.setItem('flappyHighScore', flappyHighScore);
        if (flappyNewRecordLabel) {
            flappyNewRecordLabel.style.display = 'block';
        }
    } else {
        if (flappyNewRecordLabel) {
            flappyNewRecordLabel.style.display = 'none';
        }
    }

    // Update final score display
    if (flappyFinalScore) {
        flappyFinalScore.textContent = flappyScore;
        console.log('Score updated:', flappyScore);
    }

    // Show game over modal
    if (flappyGameOverModal) {
        console.log('Showing modal...');
        flappyGameOverModal.classList.add('active');
        console.log('Modal classes:', flappyGameOverModal.classList);

        // Reset input form
        const saveForm = document.getElementById('saveScoreForm');
        const input = document.getElementById('playerNameInput');
        const btn = document.getElementById('saveScoreBtn');

        if (saveForm && flappyScore > 0) {
            saveForm.style.display = 'flex';
            if (input) input.value = '';
            if (btn) { btn.innerHTML = '💾'; btn.disabled = false; }
            setTimeout(() => input && input.focus(), 100);
        } else if (saveForm) {
            saveForm.style.display = 'none';
        }

        // Load ranking immediately (non-blocking)
        actualizarRankingUI();

    } else {
        console.error('❌ Modal element not found!');
    }
}


function toggleFlappyPause() {
    if (!isFlappyRunning) return;

    isFlappyPaused = !isFlappyPaused;

    if (isFlappyPaused) {
        flappyPauseBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M8 5L19 12L8 19V5Z" fill="currentColor"/>
            </svg>
            Reanudar
        `;
    } else {
        flappyPauseBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M10 4H6V20H10V4Z" fill="currentColor"/>
                <path d="M18 4H14V20H18V4Z" fill="currentColor"/>
            </svg>
            Pausa
        `;
        flappyGameLoop = requestAnimationFrame(updateFlappyGame);
    }
}

function resetFlappyGame() {
    stopFlappyGame();
    initFlappyBird();
    drawFlappyBird();
    flappyOverlay.classList.remove('hidden');
}

function flappyJump() {
    bird.velocity = JUMP_STRENGTH;
    playFlappyJumpSound();
}

function updateFlappyGame() {
    if (isFlappyPaused) return;

    frameCount++;

    // Update bird physics
    bird.velocity += GRAVITY;
    bird.y += bird.velocity;

    // Check ground and ceiling collision
    if (bird.y + BIRD_SIZE >= FLAPPY_CANVAS_HEIGHT || bird.y <= 0) {
        flappyGameOver();
        return;
    }

    // Update pipes
    for (let i = pipes.length - 1; i >= 0; i--) {
        const pipe = pipes[i];
        pipe.x -= PIPE_SPEED;

        // Check if bird passed pipe
        if (!pipe.passed && pipe.x + PIPE_WIDTH < bird.x) {
            pipe.passed = true;
            flappyScore++;
            updateFlappyScore();
            playFlappyScoreSound();
        }

        // Check collision with pipe
        if (checkPipeCollision(pipe)) {
            flappyGameOver();
            return;
        }

        // Remove off-screen pipes
        if (pipe.x < -PIPE_WIDTH) {
            pipes.splice(i, 1);
        }
    }

    // Add new pipes
    if (pipes.length === 0 || pipes[pipes.length - 1].x < FLAPPY_CANVAS_WIDTH - 250) {
        pipes.push(createPipe(FLAPPY_CANVAS_WIDTH));
    }

    drawFlappyBird();

    if (isFlappyRunning) {
        flappyGameLoop = requestAnimationFrame(updateFlappyGame);
    }
}

function checkPipeCollision(pipe) {
    const birdLeft = bird.x;
    const birdRight = bird.x + BIRD_SIZE;
    const birdTop = bird.y;
    const birdBottom = bird.y + BIRD_SIZE;

    const pipeLeft = pipe.x;
    const pipeRight = pipe.x + PIPE_WIDTH;

    // Check if bird is within pipe's x range
    if (birdRight > pipeLeft && birdLeft < pipeRight) {
        // Check if bird hits top or bottom pipe
        if (birdTop < pipe.topHeight || birdBottom > pipe.bottomY) {
            return true;
        }
    }

    return false;
}


function drawFlappyBird() {
    if (!flappyCtx) return;

    // Clear canvas
    flappyCtx.clearRect(0, 0, FLAPPY_CANVAS_WIDTH, FLAPPY_CANVAS_HEIGHT);

    // Draw pipes with gradients
    pipes.forEach(pipe => {
        // Base color handling (kept for themes if needed, but upgrading to gradient)
        // Create pipe gradient (Left -> Right) to simulate cylinder
        const gradient = flappyCtx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_WIDTH, 0);
        gradient.addColorStop(0, '#2ecc71');   // Darker green edge
        gradient.addColorStop(0.2, '#55efc4'); // Highlight
        gradient.addColorStop(0.5, '#2ecc71'); // Main green
        gradient.addColorStop(1, '#27ae60');   // Dark shadow acting as right edge

        // Top pipe
        flappyCtx.fillStyle = gradient;
        flappyCtx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);

        // Border for clear definition
        flappyCtx.strokeStyle = '#1e8449';
        flappyCtx.lineWidth = 2;
        flappyCtx.strokeRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);

        // Cap for top pipe (The rim)
        flappyCtx.fillStyle = gradient; // Reuse gradient or make a cap specific one
        flappyCtx.fillRect(pipe.x - 4, pipe.topHeight - 24, PIPE_WIDTH + 8, 24);
        flappyCtx.strokeRect(pipe.x - 4, pipe.topHeight - 24, PIPE_WIDTH + 8, 24);

        // Bottom pipe
        flappyCtx.fillStyle = gradient;
        flappyCtx.fillRect(pipe.x, pipe.bottomY, PIPE_WIDTH, FLAPPY_CANVAS_HEIGHT - pipe.bottomY);
        flappyCtx.strokeRect(pipe.x, pipe.bottomY, PIPE_WIDTH, FLAPPY_CANVAS_HEIGHT - pipe.bottomY);

        // Cap for bottom pipe
        flappyCtx.fillRect(pipe.x - 4, pipe.bottomY, PIPE_WIDTH + 8, 24);
        flappyCtx.strokeRect(pipe.x - 4, pipe.bottomY, PIPE_WIDTH + 8, 24);
    });

    // Draw bird/character
    flappyCtx.save();
    flappyCtx.translate(bird.x + BIRD_SIZE / 2, bird.y + BIRD_SIZE / 2);

    // Rotation based on velocity
    const rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (bird.velocity * 0.1)));
    flappyCtx.rotate(rotation);

    if (selectedCharacter === 'fran') {
        // Draw Image (Fran)
        flappyCtx.drawImage(charImage, -BIRD_SIZE / 2, -BIRD_SIZE / 2, BIRD_SIZE, BIRD_SIZE);
    } else {
        // Draw Custom Duck (Canvas Drawing) instead of Emoji
        const size = BIRD_SIZE;
        const half = size / 2;

        // 1. Body (Yellow Oval)
        flappyCtx.fillStyle = '#FFD700'; // Gold/Yellow
        flappyCtx.beginPath();
        flappyCtx.ellipse(0, 0, half, half * 0.8, 0, 0, Math.PI * 2);
        flappyCtx.fill();

        // Body Outline
        flappyCtx.strokeStyle = '#F39C12';
        flappyCtx.lineWidth = 2;
        flappyCtx.stroke();

        // 2. Wing (White/Off-white oval)
        flappyCtx.fillStyle = '#FFF8DC';
        flappyCtx.beginPath();
        // Slightly offset wing
        flappyCtx.ellipse(-5, 2, 8, 5, -0.2, 0, Math.PI * 2);
        flappyCtx.fill();
        flappyCtx.stroke();

        // 3. Eye (Big white circle with pupil)
        // White part
        flappyCtx.fillStyle = '#FFFFFF';
        flappyCtx.beginPath();
        flappyCtx.arc(6, -6, 8, 0, Math.PI * 2);
        flappyCtx.fill();
        flappyCtx.stroke();

        // Pupil (Black)
        flappyCtx.fillStyle = '#000000';
        flappyCtx.beginPath();
        flappyCtx.arc(8, -6, 3, 0, Math.PI * 2);
        flappyCtx.fill();

        // 4. Beak (Orange)
        flappyCtx.fillStyle = '#FF8C00'; // Dark Orange
        flappyCtx.beginPath();
        flappyCtx.moveTo(10, 2);
        flappyCtx.lineTo(20, 6); // Pointy end
        flappyCtx.lineTo(10, 10);
        // Curve back to head
        flappyCtx.quadraticCurveTo(8, 6, 10, 2);
        flappyCtx.fill();
        flappyCtx.stroke();
    }

    flappyCtx.restore();

    // Draw score (while playing)
    if (isFlappyRunning) {
        flappyCtx.fillStyle = '#ffffff';
        flappyCtx.font = 'bold 40px Poppins';
        flappyCtx.strokeStyle = '#000000';
        flappyCtx.lineWidth = 4;
        flappyCtx.textAlign = 'center';
        flappyCtx.strokeText(flappyScore, FLAPPY_CANVAS_WIDTH / 2, 50);
        flappyCtx.fillText(flappyScore, FLAPPY_CANVAS_WIDTH / 2, 50);
    }
}

function updateFlappyScore() {
    if (flappyScoreEl) flappyScoreEl.textContent = flappyScore;
}

function loadFlappyHighScore() {
    const saved = localStorage.getItem('flappyHighScore');
    flappyHighScore = saved ? parseInt(saved) : 0;
    if (flappyHighScoreEl) flappyHighScoreEl.textContent = flappyHighScore;
}

function saveFlappyHighScore() {
    if (flappyScore > flappyHighScore) {
        flappyHighScore = flappyScore;
        localStorage.setItem('flappyHighScore', flappyHighScore);
        if (flappyHighScoreEl) flappyHighScoreEl.textContent = flappyHighScore;
        return true;
    }
    return false;
}


// Sound effects for Flappy Bird
function playFlappyJumpSound() {
    if (!soundEnabled) return;
    initAudio();

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
}

function playFlappyScoreSound() {
    if (!soundEnabled) return;
    initAudio();

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);

    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);
}

// Función para enviar puntos a Firebase
async function guardarPuntuacionGlobal() {
    const inputObj = document.getElementById('playerNameInput');
    const nombre = inputObj.value.trim();
    const puntos = parseInt(document.getElementById('flappyFinalScore').textContent);
    const saveForm = document.getElementById('saveScoreForm');

    if (!nombre || puntos <= 0) return;

    // Feedback visual inmediato
    const btn = document.getElementById('saveScoreBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳';
    btn.disabled = true;

    try {
        await window.fs.addDoc(window.fs.collection(window.db, "ranking"), {
            jugador: nombre,
            puntos: puntos,
            fecha: new Date()
        });

        // Ocultar formulario y actualizar lista
        saveForm.style.display = 'none';
        actualizarRankingUI();
    } catch (e) {
        console.error("Error al guardar:", e);
        alert("No se pudo guardar. Verifica tu conexión.");
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Función para leer el Top 5
async function actualizarRankingUI() {
    const contenedor = document.getElementById('onlineScoresList');
    if (!contenedor) return;

    contenedor.innerHTML = '<div class="ranking-loading-small">Cargando...</div>';

    try {
        const q = window.fs.query(
            window.fs.collection(window.db, "ranking"),
            window.fs.orderBy("puntos", "desc"),
            window.fs.limit(5)
        );
        const querySnapshot = await window.fs.getDocs(q);

        let html = "";
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            html += `<div class="ranking-row-small">
                        <span>${data.jugador.substring(0, 10)}</span>
                        <span>${data.puntos}</span>
                     </div>`;
        });

        contenedor.innerHTML = html || '<div style="text-align:center; padding:10px;">¡Sé el primero!</div>';
    } catch (e) {
        console.warn("Firebase error:", e);
        contenedor.innerHTML = '<div style="text-align:center; color: #ff6b6b; padding:10px;">Ranking no disponible</div>';
    }
}

// Vinculamos el botón de guardar
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('saveScoreBtn');
    if (btn) btn.addEventListener('click', guardarPuntuacionGlobal);
});

// ===== START APPLICATION =====
window.addEventListener('DOMContentLoaded', () => {
    init();
    // Retry initialization if Firebase isn't ready immediately
    if (window.fs && window.db) {
        initClickerGame();
    } else {
        console.warn("Firebase not ready, retrying in 500ms...");
        setTimeout(initClickerGame, 500);
    }
});

// ===== GOLDEN DUCK CLICKER LOGIC =====
function initClickerGame() {
    const duck = document.getElementById('goldenDuck');
    const apple = document.getElementById('goldenApple');
    const goat = document.getElementById('goldenGoat');
    const principito = document.getElementById('goldenPrincipito');
    const counterDisplay = document.getElementById('globalClickCount');
    const skinBtns = document.querySelectorAll('.skin-btn');

    // We can click any active item
    const clickables = [duck, apple, goat, principito];

    if (!duck || !counterDisplay) return;

    // Skin switching logic
    skinBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Visual toggle
            skinBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const mode = btn.dataset.skin;
            duck.style.display = 'none';
            apple.style.display = 'none';
            if (goat) goat.style.display = 'none';
            if (principito) principito.style.display = 'none';

            if (mode === 'duck') {
                duck.style.display = 'block';
            } else if (mode === 'apple') {
                apple.style.display = 'block';
            } else if (mode === 'goat' && goat) {
                goat.style.display = 'block';
            } else if (mode === 'principito' && principito) {
                principito.style.display = 'block';
            }
        });
    });

    // 1. Listen for real-time updates
    if (window.fs && window.db) {
        const docRef = window.fs.doc(window.db, "clicks", "global");

        // Real-time listener
        window.fs.onSnapshot(docRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                counterDisplay.textContent = data.count.toLocaleString();
                // Add a small "bump" effect to counter
                counterDisplay.style.transform = "scale(1.1)";
                setTimeout(() => counterDisplay.style.transform = "scale(1)", 100);
            } else {
                // If doc doesn't exist, create it locally first for UI
                counterDisplay.textContent = "0";
            }
        });
    }

    // 2. Click Handler
    const handleClick = async (e) => {
        // Visuals
        createParticle(e.clientX, e.clientY);
        playQuackSound();

        // Database Update
        if (window.fs && window.db) {
            const docRef = window.fs.doc(window.db, "clicks", "global");
            try {
                await window.fs.updateDoc(docRef, {
                    count: window.fs.increment(1)
                }).catch(async (error) => {
                    if (error.code === 'not-found') {
                        await window.fs.setDoc(docRef, { count: 1 });
                    }
                });
            } catch (err) {
                console.error("Click error:", err);
            }
        }
    };

    // Attach listeners to both items
    clickables.forEach(item => {
        if (item) item.addEventListener('pointerdown', handleClick);
    });
}

function createParticle(x, y) {
    const particle = document.createElement('div');
    particle.textContent = "+1";
    particle.className = "click-particle";
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    document.body.appendChild(particle);

    setTimeout(() => particle.remove(), 1000);
}

function playQuackSound() {
    if (!audioContext || !soundEnabled) return;

    // Simple synthesized "quack" / click sound
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    osc.start();
    osc.stop(audioContext.currentTime + 0.1);
}
