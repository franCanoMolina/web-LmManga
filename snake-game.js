// ===== NAVIGATION SYSTEM =====
function initNavigation() {
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.mode;
            switchMode(mode);
        });
    });
}

function switchMode(mode) {
    // Update nav buttons
    navBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Update sections
    modeSections.forEach(section => {
        section.classList.toggle('active', section.id === `${mode}Section`);
    });

    // Stop Snake game if switching away
    if (mode !== 'snake' && isGameRunning) {
        stopGame();
    }
}

// ===== SNAKE GAME LOGIC =====
function initSnake() {
    snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    gameSpeed = 150;
    updateScore();
    spawnFood();
}

function startGame() {
    if (isGameRunning) return;

    initSnake();
    gameOverlay.classList.add('hidden');
    isGameRunning = true;
    isPaused = false;
    gameLoop = setInterval(updateGame, gameSpeed);
}

function stopGame() {
    isGameRunning = false;
    isPaused = false;
    clearInterval(gameLoop);
    gameLoop = null;
}

function togglePause() {
    if (!isGameRunning) return;

    isPaused = !isPaused;

    if (isPaused) {
        clearInterval(gameLoop);
        pauseBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M8 5L19 12L8 19V5Z" fill="currentColor"/>
            </svg>
            Reanudar
        `;
    } else {
        gameLoop = setInterval(updateGame, gameSpeed);
        pauseBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M10 4H6V20H10V4Z" fill="currentColor"/>
                <path d="M18 4H14V20H18V4Z" fill="currentColor"/>
            </svg>
            Pausa
        `;
    }
}

function resetGame() {
    stopGame();
    initSnake();
    drawSnake();
    gameOverlay.classList.remove('hidden');
}

function updateGame() {
    if (isPaused) return;

    // Update direction
    direction = { ...nextDirection };

    // Calculate new head position
    const newHead = {
        x: snake[0].x + direction.x,
        y: snake[0].y + direction.y
    };

    // Check wall collision
    if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
        gameOver();
        return;
    }

    // Check self collision
    if (snake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
        gameOver();
        return;
    }

    // Add new head
    snake.unshift(newHead);

    // Check food collision
    if (newHead.x === food.x && newHead.y === food.y) {
        score += 10;
        updateScore();
        spawnFood();
        playEatSound();

        // Increase speed every 50 points
        if (score % 50 === 0 && gameSpeed > 50) {
            gameSpeed -= 10;
            clearInterval(gameLoop);
            gameLoop = setInterval(updateGame, gameSpeed);
        }
    } else {
        // Remove tail if no food eaten
        snake.pop();
    }

    drawSnake();
}

function handleKeyPress(e) {
    if (!isGameRunning || isPaused) return;

    const key = e.key;

    if (key === 'ArrowUp' || key === 'w' || key === 'W') {
        handleDirectionChange('up');
    } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
        handleDirectionChange('down');
    } else if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
        handleDirectionChange('left');
    } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
        handleDirectionChange('right');
    } else if (key === ' ') {
        e.preventDefault();
        togglePause();
    }
}

function handleDirectionChange(dir) {
    switch (dir) {
        case 'up':
            if (direction.y === 0) nextDirection = { x: 0, y: -1 };
            break;
        case 'down':
            if (direction.y === 0) nextDirection = { x: 0, y: 1 };
            break;
        case 'left':
            if (direction.x === 0) nextDirection = { x: -1, y: 0 };
            break;
        case 'right':
            if (direction.x === 0) nextDirection = { x: 1, y: 0 };
            break;
    }
}

function spawnFood() {
    let newFood;
    do {
        newFood = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE)
        };
    } while (snake.some(segment => segment.x === newFood.x && segment.y === newFood.y));

    food = newFood;
}

function drawSnake() {
    if (!snakeCtx) return;

    // Clear canvas
    snakeCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    snakeCtx.fillRect(0, 0, snakeCanvas.width, snakeCanvas.height);

    // Draw grid
    snakeCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    snakeCtx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
        snakeCtx.beginPath();
        snakeCtx.moveTo(i * CELL_SIZE, 0);
        snakeCtx.lineTo(i * CELL_SIZE, snakeCanvas.height);
        snakeCtx.stroke();

        snakeCtx.beginPath();
        snakeCtx.moveTo(0, i * CELL_SIZE);
        snakeCtx.lineTo(snakeCanvas.width, i * CELL_SIZE);
        snakeCtx.stroke();
    }

    // Draw snake with gradient
    snake.forEach((segment, index) => {
        const gradient = snakeCtx.createLinearGradient(
            segment.x * CELL_SIZE,
            segment.y * CELL_SIZE,
            (segment.x + 1) * CELL_SIZE,
            (segment.y + 1) * CELL_SIZE
        );

        // Use theme colors
        const opacity = 1 - (index / snake.length) * 0.5;

        if (currentTheme === 'neon') {
            gradient.addColorStop(0, `rgba(0, 255, 136, ${opacity})`);
            gradient.addColorStop(1, `rgba(0, 255, 255, ${opacity})`);
        } else if (currentTheme === 'ocean') {
            gradient.addColorStop(0, `rgba(0, 119, 190, ${opacity})`);
            gradient.addColorStop(1, `rgba(0, 212, 255, ${opacity})`);
        } else if (currentTheme === 'fire') {
            gradient.addColorStop(0, `rgba(255, 107, 53, ${opacity})`);
            gradient.addColorStop(1, `rgba(255, 0, 84, ${opacity})`);
        } else {
            gradient.addColorStop(0, `rgba(102, 126, 234, ${opacity})`);
            gradient.addColorStop(1, `rgba(118, 75, 162, ${opacity})`);
        }

        snakeCtx.fillStyle = gradient;
        snakeCtx.fillRect(
            segment.x * CELL_SIZE + 1,
            segment.y * CELL_SIZE + 1,
            CELL_SIZE - 2,
            CELL_SIZE - 2
        );

        // Draw eyes on head
        if (index === 0) {
            snakeCtx.fillStyle = 'white';
            const eyeSize = 3;
            const eyeOffset = 6;

            if (direction.x === 1) { // Right
                snakeCtx.fillRect(segment.x * CELL_SIZE + eyeOffset + 5, segment.y * CELL_SIZE + 5, eyeSize, eyeSize);
                snakeCtx.fillRect(segment.x * CELL_SIZE + eyeOffset + 5, segment.y * CELL_SIZE + 12, eyeSize, eyeSize);
            } else if (direction.x === -1) { // Left
                snakeCtx.fillRect(segment.x * CELL_SIZE + eyeOffset - 2, segment.y * CELL_SIZE + 5, eyeSize, eyeSize);
                snakeCtx.fillRect(segment.x * CELL_SIZE + eyeOffset - 2, segment.y * CELL_SIZE + 12, eyeSize, eyeSize);
            } else if (direction.y === -1) { // Up
                snakeCtx.fillRect(segment.x * CELL_SIZE + 5, segment.y * CELL_SIZE + eyeOffset - 2, eyeSize, eyeSize);
                snakeCtx.fillRect(segment.x * CELL_SIZE + 12, segment.y * CELL_SIZE + eyeOffset - 2, eyeSize, eyeSize);
            } else { // Down
                snakeCtx.fillRect(segment.x * CELL_SIZE + 5, segment.y * CELL_SIZE + eyeOffset + 5, eyeSize, eyeSize);
                snakeCtx.fillRect(segment.x * CELL_SIZE + 12, segment.y * CELL_SIZE + eyeOffset + 5, eyeSize, eyeSize);
            }
        }
    });

    // Draw food (apple)
    const foodX = food.x * CELL_SIZE;
    const foodY = food.y * CELL_SIZE;

    // Apple body
    const foodGradient = snakeCtx.createRadialGradient(
        foodX + CELL_SIZE / 2,
        foodY + CELL_SIZE / 2,
        2,
        foodX + CELL_SIZE / 2,
        foodY + CELL_SIZE / 2,
        CELL_SIZE / 2
    );
    foodGradient.addColorStop(0, '#ff4444');
    foodGradient.addColorStop(1, '#cc0000');

    snakeCtx.fillStyle = foodGradient;
    snakeCtx.beginPath();
    snakeCtx.arc(foodX + CELL_SIZE / 2, foodY + CELL_SIZE / 2, CELL_SIZE / 2 - 2, 0, Math.PI * 2);
    snakeCtx.fill();

    // Apple highlight
    snakeCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    snakeCtx.beginPath();
    snakeCtx.arc(foodX + CELL_SIZE / 3, foodY + CELL_SIZE / 3, 3, 0, Math.PI * 2);
    snakeCtx.fill();
}

function updateScore() {
    if (currentScoreEl) currentScoreEl.textContent = score;
}

function loadHighScore() {
    const saved = localStorage.getItem('snakeHighScore');
    highScore = saved ? parseInt(saved) : 0;
    if (highScoreEl) highScoreEl.textContent = highScore;
}

function saveHighScore() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snakeHighScore', highScore);
        if (highScoreEl) highScoreEl.textContent = highScore;
        return true;
    }
    return false;
}

function gameOver() {
    stopGame();
    playGameOverSound();

    const isNewRecord = saveHighScore();

    if (finalScoreEl) finalScoreEl.textContent = score;
    if (newRecordLabel) {
        newRecordLabel.style.display = isNewRecord ? 'block' : 'none';
    }

    gameOverModal.classList.add('active');
}

// Sound effects for Snake
function playEatSound() {
    if (!soundEnabled) return;
    initAudio();

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
}

function playGameOverSound() {
    if (!soundEnabled) return;
    initAudio();

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.5);

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.5);
}
