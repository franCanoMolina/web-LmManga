import React, { useRef, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';

// Constants
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const LANE_COUNT = 3;
const GRAVITY = 1.6;
const JUMP_STRENGTH = -22;
const BASE_SPEED = 5;
const PLAYER_SIZE = 40;

const OBSTACLE_SPAWN_DISTANCE = 500;

// Enhanced 3D Perspective constants
const VANISHING_POINT_Y = CANVAS_HEIGHT - 380; // Even closer vanishing point for more 3D depth
const HORIZON_ROAD_WIDTH = 60;  // Narrower at horizon for dramatic perspective
const BOTTOM_ROAD_WIDTH = 300;  // Wider at bottom for strong 3D effect

// Helper function to calculate lane position with perspective
const getLaneXAt = (lane: number, z: number): number => {
    const progress = 1 - (z / OBSTACLE_SPAWN_DISTANCE);
    const roadWidth = HORIZON_ROAD_WIDTH + (BOTTOM_ROAD_WIDTH - HORIZON_ROAD_WIDTH) * progress;
    const laneOffset = (lane - 1) * (roadWidth / LANE_COUNT);
    return CANVAS_WIDTH / 2 + laneOffset;
};

// Helper to calculate Y position with vertical compression
const getScreenY = (z: number): number => {
    const progress = 1 - (z / OBSTACLE_SPAWN_DISTANCE);
    // Objects higher in distance, compressed near horizon
    return VANISHING_POINT_Y + (CANVAS_HEIGHT - VANISHING_POINT_Y - 100) * progress;
};

// Helper: Linear Interpolation for Colors
const lerpColor = (a: string, b: string, amount: number) => {
    const ah = parseInt(a.replace(/#/g, ''), 16),
        ar = ah >> 16, ag = ah >> 8 & 0xff, ab = ah & 0xff,
        bh = parseInt(b.replace(/#/g, ''), 16),
        br = bh >> 16, bg = bh >> 8 & 0xff, bb = bh & 0xff,
        rr = ar + amount * (br - ar),
        rg = ag + amount * (bg - ag),
        rb = ab + amount * (bb - ab);

    return '#' + ((1 << 24) + (rr << 16) + (rg << 8) + (rb | 0)).toString(16).slice(1);
};

type GameState = 'start' | 'playing' | 'gameover';
type ObstacleType = 'low' | 'high' | 'coin' | 'sign';

interface Obstacle {
    lane: number;
    type: ObstacleType;
    z: number;
    signText?: string[]; // Optional text for signs
}

interface Player {
    lane: number;
    y: number;
    velocity: number;
    isDucking: boolean;
    targetLane: number;
}

const RunnerGame: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { user, gameData, updateRunnerHighScore } = useAuth();
    const [gameState, setGameState] = useState<GameState>('start');
    const [highScore, setHighScore] = useState(0);
    const [leaderboard, setLeaderboard] = useState<{ name: string, score: number, coins: number }[]>([]);

    const gameStateRef = useRef<GameState>('start');
    const scoreRef = useRef(0);
    const coinsRef = useRef(0);
    const distanceRef = useRef(0);
    const speedRef = useRef(BASE_SPEED);
    const frameRef = useRef(0);
    const lastTimeRef = useRef<number>(0);
    const lastObstacleZ = useRef(0);

    const cloudOffsetRef = useRef(0);
    const buildingOffsetRef = useRef(0);

    const playerRef = useRef<Player>({
        lane: 1,
        y: 0,
        velocity: 0,
        isDucking: false,
        targetLane: 1
    });

    const obstaclesRef = useRef<Obstacle[]>([]);

    // Touch control state
    const touchStartRef = useRef<{ x: number, y: number, time: number } | null>(null);

    useEffect(() => {
        fetchLeaderboard();
        gameStateRef.current = 'start';
        requestAnimationFrame(loop);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameStateRef.current === 'start' && (e.code === 'Space' || e.code === 'ArrowUp')) {
                e.preventDefault();
                startGame();
            } else if (gameStateRef.current === 'playing') {
                e.preventDefault();
                handleInput(e.code);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (gameStateRef.current === 'playing' && (e.code === 'ArrowDown' || e.code === 'KeyS')) {
                playerRef.current.isDucking = false;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        };
    }, []);

    const fetchLeaderboard = async () => {
        try {
            const q = query(collection(db, 'runner-leaderboard'), orderBy('score', 'desc'), limit(5));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => doc.data() as { name: string, score: number, coins: number });
            setLeaderboard(data);
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
        }
    };

    const submitScore = async () => {
        if (!user || scoreRef.current <= 0) return;
        try {
            await addDoc(collection(db, 'runner-leaderboard'), {
                name: user.username,
                score: scoreRef.current,
                coins: coinsRef.current,
                distance: distanceRef.current,
                timestamp: serverTimestamp()
            });
            await fetchLeaderboard();
        } catch (error) {
            console.error('Error submitting score:', error);
        }
    };

    const startGame = () => {
        playerRef.current = { lane: 1, y: 0, velocity: 0, isDucking: false, targetLane: 1 };
        obstaclesRef.current = [];
        scoreRef.current = 0;
        coinsRef.current = 0;
        distanceRef.current = 0;
        speedRef.current = BASE_SPEED;
        lastObstacleZ.current = 0;
        cloudOffsetRef.current = 0;
        buildingOffsetRef.current = 0;
        setGameState('playing');
        gameStateRef.current = 'playing';
    };

    const resetToStart = () => {
        playerRef.current = { lane: 1, y: 0, velocity: 0, isDucking: false, targetLane: 1 };
        obstaclesRef.current = [];
        setGameState('start');
        gameStateRef.current = 'start';
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        requestAnimationFrame(loop);
    };

    const handleInput = (code: string) => {
        const player = playerRef.current;

        if (code === 'ArrowLeft' || code === 'KeyA') {
            player.targetLane = Math.max(0, player.targetLane - 1);
        } else if (code === 'ArrowRight' || code === 'KeyD') {
            player.targetLane = Math.min(LANE_COUNT - 1, player.targetLane + 1);
        }

        if ((code === 'ArrowUp' || code === 'KeyW' || code === 'Space') && player.y === 0 && !player.isDucking) {
            player.velocity = JUMP_STRENGTH;
        }

        if ((code === 'ArrowDown' || code === 'KeyS') && player.y === 0) {
            player.isDucking = true;
        }
    };

    // Touch event handlers for mobile
    const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const touch = e.touches[0];
        touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now()
        };

        // Start game on touch if on start screen
        if (gameStateRef.current === 'start') {
            startGame();
        }
    };

    const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        if (!touchStartRef.current || gameStateRef.current !== 'playing') {
            touchStartRef.current = null;
            return;
        }

        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - touchStartRef.current.x;
        const deltaY = touch.clientY - touchStartRef.current.y;

        const SWIPE_THRESHOLD = 40;

        // Determine primary swipe direction
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        // Only process if it was a swipe (not a tap)
        if (absX > SWIPE_THRESHOLD || absY > SWIPE_THRESHOLD) {
            // Horizontal swipe (lane change) - takes priority if mostly horizontal
            if (absX > absY) {
                if (deltaX > 0) {
                    handleInput('ArrowRight');
                } else {
                    handleInput('ArrowLeft');
                }
            }
            // Vertical swipe
            else {
                if (deltaY < 0) {
                    // Swipe up - Jump
                    handleInput('Space');
                } else {
                    // Swipe down - Duck
                    handleInput('ArrowDown');
                }
            }
        }

        touchStartRef.current = null;
    };

    // Handle touch move for continuous ducking
    const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        if (!touchStartRef.current || gameStateRef.current !== 'playing') {
            return;
        }

        const touch = e.touches[0];
        const deltaY = touch.clientY - touchStartRef.current.y;

        // If swiping down significantly, start ducking
        if (deltaY > 50) {
            playerRef.current.isDucking = true;
        }
    };

    // Reset ducking when touch ends
    const handleTouchCancel = () => {
        playerRef.current.isDucking = false;
        touchStartRef.current = null;
    };



    // Generate a trail of coins (like Subway Surfers)
    const spawnCoinTrail = () => {
        // Randomly choose trail length (3 to 6 coins)
        const trailLength = 3 + Math.floor(Math.random() * 4);

        // Randomly decide trail pattern:
        // 0 = straight line in one lane
        // 1 = zigzag between two lanes
        // 2 = diagonal across all lanes
        const pattern = Math.floor(Math.random() * 3);
        const startLane = Math.floor(Math.random() * LANE_COUNT);

        for (let i = 0; i < trailLength; i++) {
            let lane = startLane;

            if (pattern === 1) {
                // Zigzag: alternate between two adjacent lanes
                const adjacentLane = Math.min(LANE_COUNT - 1, startLane + 1);
                lane = i % 2 === 0 ? startLane : adjacentLane;
            } else if (pattern === 2) {
                // Diagonal: move across lanes
                lane = (startLane + i) % LANE_COUNT;
            }
            // pattern 0 keeps the same lane (straight line)

            obstaclesRef.current.push({
                lane,
                type: 'coin',
                z: OBSTACLE_SPAWN_DISTANCE - (i * 40) // Space coins 40 units apart
            });
        }

        lastObstacleZ.current = OBSTACLE_SPAWN_DISTANCE;
    };

    const spawnObstacle = () => {
        // Difficulty Scaling based on Distance
        const distance = distanceRef.current;
        let obstacleCount;

        // Phase 3: "EL CALENTÓN" (Hardcore Mode) - > 1000m
        // Always spawn 3 obstacles (blocking all lanes), but guaranteed 1 is a coin
        if (distance > 1000) {
            obstacleCount = 3;
        }
        // Phase 2: Warming Up - > 500m
        // High chance of 2 obstacles
        else if (distance > 500) {
            const rand = Math.random();
            if (rand < 0.1) obstacleCount = 1;
            else if (rand < 0.7) obstacleCount = 2; // 60% chance
            else obstacleCount = 3; // 30% chance
        }
        // Phase 0/1: Starting out
        else {
            // 30% chance of 1 obstacle
            // 50% chance of 2 obstacles
            // 20% chance of 3 obstacles
            const rand = Math.random();
            if (rand < 0.3) obstacleCount = 1;
            else if (rand < 0.8) obstacleCount = 2;
            else obstacleCount = 3;
        }

        // 20% chance to spawn a "Llegando al calentón" sign on the side
        // Only if not in hardcore mode (to keep screen clear) or just occasionally
        if (Math.random() < 0.2) {
            const signSide = Math.random() < 0.5 ? -1.5 : 3.5; // Left shoulder (-1.5) or Right shoulder (3.5)

            // Alternate sign text
            const isPeru = Math.random() < 0.5;
            const text = isPeru ? ['GO', 'PERU 🇵🇪'] : ['LLEGANDO AL', 'CALENTÓN 🔥'];

            obstaclesRef.current.push({
                lane: signSide,
                type: 'sign',
                z: OBSTACLE_SPAWN_DISTANCE,
                signText: text
            });
        }

        // Coin trail chance (reduced in hardcore mode to prevent too easy passage)
        if (distance <= 1000 && Math.random() < 0.3) {
            spawnCoinTrail();
            return;
        }

        const types: ObstacleType[] = ['low', 'high', 'coin', 'coin'];
        const occupiedLanes = new Set<number>();

        for (let i = 0; i < obstacleCount; i++) {
            let type = types[Math.floor(Math.random() * types.length)];

            // If spawning 3 obstacles (all lanes), ensure at least one is a coin for fairness
            if (obstacleCount === 3) {
                // Check if this is the last obstacle to be added and no coins exist yet
                const currentSpawned = obstaclesRef.current.slice(obstaclesRef.current.length - i);
                const hasCoin = currentSpawned.some(o => o.type === 'coin');

                if (i === obstacleCount - 1 && !hasCoin) {
                    type = 'coin';
                }
            }

            // Pick a lane that's not already occupied in this spawn
            let lane;
            let attempts = 0;
            do {
                lane = Math.floor(Math.random() * LANE_COUNT);
                attempts++;
            } while (occupiedLanes.has(lane) && attempts < 10);

            if (!occupiedLanes.has(lane)) {
                occupiedLanes.add(lane);
                obstaclesRef.current.push({
                    lane,
                    type,
                    z: OBSTACLE_SPAWN_DISTANCE
                });
            }
        }

        lastObstacleZ.current = OBSTACLE_SPAWN_DISTANCE;
    };

    const loop = (currentTime: number) => {
        if (gameStateRef.current !== 'playing' && gameStateRef.current !== 'start') return;

        const deltaTime = lastTimeRef.current ? Math.min((currentTime - lastTimeRef.current) / 16.67, 2) : 1;
        lastTimeRef.current = currentTime;

        updatePhysics(deltaTime);
        draw();

        if (gameStateRef.current === 'playing') {
            checkCollisions();
        }

        frameRef.current = requestAnimationFrame(loop);
    };

    const updatePhysics = (deltaTime: number) => {
        if (gameStateRef.current !== 'playing') return;

        const player = playerRef.current;

        // Lane interpolation with smooth lerp (0.2 = smoothness factor)
        if (Math.abs(player.lane - player.targetLane) > 0.01) {
            const lerpFactor = 0.2 * deltaTime;
            player.lane += (player.targetLane - player.lane) * lerpFactor;
        } else {
            player.lane = player.targetLane;
        }

        // Jump physics
        if (player.y !== 0 || player.velocity !== 0) {
            player.velocity += GRAVITY * deltaTime;
            player.y += player.velocity * deltaTime;

            if (player.y > 0) {
                player.y = 0;
                player.velocity = 0;
            }
        }

        // Move obstacles
        const speed = speedRef.current * deltaTime;
        for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
            const obstacle = obstaclesRef.current[i];
            obstacle.z -= speed;

            if (obstacle.z < -400) { // Keep obstacles longer for rearview effect
                obstaclesRef.current.splice(i, 1);
            }
        }

        // Spawn new obstacles - increased frequency from 150 to 120 for more challenge
        if (obstaclesRef.current.length === 0 || lastObstacleZ.current < OBSTACLE_SPAWN_DISTANCE - 120) {
            spawnObstacle();
        }

        // Parallax background movement
        cloudOffsetRef.current += speed * 0.1;
        buildingOffsetRef.current += speed * 0.3;

        // Update score and speed
        distanceRef.current += speed / 10;
        scoreRef.current = Math.floor(distanceRef.current) + coinsRef.current * 10;
        speedRef.current = Math.min(BASE_SPEED * 4, BASE_SPEED + distanceRef.current / 200);
    };

    const checkCollisions = () => {
        const player = playerRef.current;
        const playerLane = Math.round(player.lane);

        for (const obstacle of obstaclesRef.current) {
            // Reduced Z-range from [-10, 10] to [-5, 3] for more accurate visual collision
            // This makes collision detection happen later, closer to actual visual contact
            // Increased Z-range to [-25, 25] to catch high-speed objects (speed can be ~20/frame)
            if (obstacle.z <= 25 && obstacle.z >= -25) {
                if (obstacle.lane === playerLane) {
                    if (obstacle.type === 'coin') {
                        coinsRef.current += 1;
                        scoreRef.current += 10;
                        obstaclesRef.current = obstaclesRef.current.filter(o => o !== obstacle);
                    } else if (obstacle.type === 'low' && player.y <= -45) {
                        // Jumped over - increased threshold from -40 to -45 for more forgiving gameplay
                    } else if (obstacle.type === 'high' && player.isDucking) {
                        // Ducked under
                    } else {
                        endGame();
                    }
                }
            }
        }
    };

    const endGame = async () => {
        gameStateRef.current = 'gameover';
        setGameState('gameover');
        cancelAnimationFrame(frameRef.current);

        const finalScore = scoreRef.current;

        // Update user's personal high score if beaten
        if (user && finalScore > gameData.runnerHighScore) {
            await updateRunnerHighScore(finalScore);
        }

        // Update local high score for display
        if (finalScore > highScore) {
            setHighScore(finalScore);
        }

        submitScore();
        draw();
    };

    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Tunnel Logic
        const distance = distanceRef.current;
        const cycle = distance % 3000;

        let darkness = 0; // 0 = Day, 1 = Full Tunnel

        // Prevent initial spawn inside tunnel animation
        if (distance < 200) {
            darkness = 0;
        } else if (cycle > 2000) {
            darkness = 1; // Full Tunnel
        } else if (cycle > 1800) {
            // Transition In (1800-2000)
            darkness = (cycle - 1800) / 200;
        } else if (cycle < 200) {
            // Transition Out (0-200 of next cycle)
            darkness = 1 - (cycle / 200);
        } else {
            darkness = 0; // Day
        }

        // Colors
        const skyColor = lerpColor('#7FB3D5', '#050510', darkness);
        const groundColor = lerpColor('#6B8E23', '#1a1a1a', darkness);
        const roadColorStart = lerpColor('#666666', '#111111', darkness);
        const roadColorEnd = lerpColor('#2E2E2E', '#050505', darkness);
        const wallColor = lerpColor('#5D4037', '#111111', darkness);

        // Sky / Background
        ctx.fillStyle = skyColor;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        if (darkness > 0.1) {
            // Ceiling Lights Effect (Only visible when dark)
            // Moving lights to simulate speed in tunnel
            ctx.fillStyle = `rgba(255, 255, 224, ${darkness})`; // Fade in lights
            ctx.shadowBlur = 20 * darkness;
            ctx.shadowColor = '#FFFFE0';
            const time = Date.now() / 100;
            for (let i = 0; i < 6; i++) {
                // Simulate perspective of lights on ceiling
                const z = (time * 15 + i * 200) % 1000;
                // Simple 2D projection for ceiling lights
                const progress = 1 - (z / 1000);
                const y = VANISHING_POINT_Y - 150 * progress;
                if (y < 0) continue;
                const size = 3 + 8 * progress;

                // Center line lights
                ctx.beginPath();
                ctx.arc(CANVAS_WIDTH / 2, y, size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.shadowBlur = 0;
        }

        if (darkness < 1) {
            // Day Elements (Sun, Clouds, City) fade out
            ctx.globalAlpha = 1 - darkness;

            // Subtle sun (less prominent) calls
            ctx.fillStyle = 'rgba(255, 235, 150, 0.3)';
            ctx.beginPath();
            ctx.arc(340, 80, 50, 0, Math.PI * 2);
            ctx.fill();

            // Clouds
            const cloudParallax = cloudOffsetRef.current % 800;
            drawMinimalCloud(ctx, 100 - cloudParallax * 0.3, 60, 30);
            drawMinimalCloud(ctx, 280 - cloudParallax * 0.3, 90, 35);

            // Skyline
            drawSimpleSkyline(ctx, buildingOffsetRef.current);

            ctx.globalAlpha = 1.0;
        }

        // Ground base
        // Ground base
        const groundGradient = ctx.createLinearGradient(0, VANISHING_POINT_Y, 0, CANVAS_HEIGHT);
        groundGradient.addColorStop(0, groundColor);
        groundGradient.addColorStop(1, lerpColor('#689F38', '#000000', darkness)); // slightly lighter green to black
        ctx.fillStyle = groundGradient;
        ctx.fillRect(0, VANISHING_POINT_Y, CANVAS_WIDTH, CANVAS_HEIGHT - VANISHING_POINT_Y);

        // LEFT side area (grass/barrier) with perspective
        ctx.fillStyle = wallColor;
        ctx.beginPath();
        ctx.moveTo(0, CANVAS_HEIGHT); // Bottom-left corner
        ctx.lineTo(CANVAS_WIDTH / 2 - BOTTOM_ROAD_WIDTH / 2, CANVAS_HEIGHT); // Bottom-left road edge
        ctx.lineTo(CANVAS_WIDTH / 2 - HORIZON_ROAD_WIDTH / 2, VANISHING_POINT_Y); // Horizon-left road edge
        ctx.lineTo(0, VANISHING_POINT_Y); // Top-left corner
        ctx.closePath();
        ctx.fill();

        // Left barrier highlight
        ctx.strokeStyle = 'rgba(121, 85, 72, 0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(CANVAS_WIDTH / 2 - BOTTOM_ROAD_WIDTH / 2, CANVAS_HEIGHT);
        ctx.lineTo(CANVAS_WIDTH / 2 - HORIZON_ROAD_WIDTH / 2, VANISHING_POINT_Y);
        ctx.stroke();

        // RIGHT side area (grass/barrier) with perspective
        ctx.fillStyle = wallColor;
        ctx.beginPath();
        ctx.moveTo(CANVAS_WIDTH, CANVAS_HEIGHT); // Bottom-right corner
        ctx.lineTo(CANVAS_WIDTH / 2 + BOTTOM_ROAD_WIDTH / 2, CANVAS_HEIGHT); // Bottom-right road edge
        ctx.lineTo(CANVAS_WIDTH / 2 + HORIZON_ROAD_WIDTH / 2, VANISHING_POINT_Y); // Horizon-right road edge
        ctx.lineTo(CANVAS_WIDTH, VANISHING_POINT_Y); // Top-right corner
        ctx.closePath();
        ctx.fill();

        // Right barrier highlight
        ctx.strokeStyle = 'rgba(121, 85, 72, 0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(CANVAS_WIDTH / 2 + BOTTOM_ROAD_WIDTH / 2, CANVAS_HEIGHT);
        ctx.lineTo(CANVAS_WIDTH / 2 + HORIZON_ROAD_WIDTH / 2, VANISHING_POINT_Y);
        ctx.stroke();

        // Road surface with proper grounding and perspective
        const roadGradient = ctx.createLinearGradient(0, VANISHING_POINT_Y, 0, CANVAS_HEIGHT);

        roadGradient.addColorStop(0, roadColorStart);
        roadGradient.addColorStop(1, roadColorEnd);

        ctx.fillStyle = roadGradient;

        // Draw road as trapezoid following perspective
        ctx.beginPath();
        ctx.moveTo(CANVAS_WIDTH / 2 - BOTTOM_ROAD_WIDTH / 2, CANVAS_HEIGHT); // Bottom-left
        ctx.lineTo(CANVAS_WIDTH / 2 + BOTTOM_ROAD_WIDTH / 2, CANVAS_HEIGHT); // Bottom-right
        ctx.lineTo(CANVAS_WIDTH / 2 + HORIZON_ROAD_WIDTH / 2, VANISHING_POINT_Y); // Horizon-right
        ctx.lineTo(CANVAS_WIDTH / 2 - HORIZON_ROAD_WIDTH / 2, VANISHING_POINT_Y); // Horizon-left
        ctx.closePath();
        ctx.fill();

        // Road edges - yellow lines (PROPER PERSPECTIVE)
        drawRoadEdgesWithPerspective(ctx);

        // Lane dividers (PROPER PERSPECTIVE)
        drawLaneDividersWithPerspective(ctx);

        // Draw obstacles and player with Z-layering for depth
        // 1. Draw obstacles BEHIND or AT player (z >= -10)
        drawObstacles(ctx, 'background');

        // 2. Draw player
        drawPlayer(ctx);

        // 3. Draw obstacles IN FRONT of player (passed) (z < -10)
        // We draw them on top to simulate them passing the camera
        drawObstacles(ctx, 'foreground');

        // Compact modern HUD
        drawModernHUD(ctx);
    };

    const drawMinimalCloud = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
        if (x < -100 || x > CANVAS_WIDTH + 100) return;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.arc(x + size * 0.5, y, size * 0.7, 0, Math.PI * 2);
        ctx.fill();
    };

    const drawSimpleSkyline = (ctx: CanvasRenderingContext2D, offset: number) => {
        // Very simple, subtle background buildings
        ctx.fillStyle = 'rgba(120, 120, 120, 0.15)';
        for (let i = 0; i < 8; i++) {
            const x = 100 + i * 40 - (offset % 600) * 0.1;
            const height = 60 + (i % 3) * 20;
            if (x > -50 && x < CANVAS_WIDTH + 50) {
                ctx.fillRect(x, CANVAS_HEIGHT - 200 - height, 30, height);
            }
        }
    };



    const drawModernHUD = (ctx: CanvasRenderingContext2D) => {
        // Compact, clean HUD top-left

        // Semi-transparent background bar
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.roundRect(8, 8, 195, 50, 8);
        ctx.fill();

        // Subtle border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(8, 8, 195, 50, 8);
        ctx.stroke();

        // Stats in a row (most important = bigger)
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        // Distance (primary metric - larger)
        ctx.font = 'bold 22px Arial';
        ctx.fillText(`${Math.floor(distanceRef.current)}m`, 18, 22);

        // Coins (secondary)
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`💰${coinsRef.current}`, 18, 42);

        // Speed indicator (visual only)
        ctx.fillStyle = '#4CAF50';
        const speedPercent = ((speedRef.current - BASE_SPEED) / BASE_SPEED) * 100;
        ctx.fillText(`⚡${speedPercent.toFixed(0)}%`, 100, 42);

        // Score (top right corner, smaller)
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.textAlign = 'right';
        ctx.fillText(`${scoreRef.current}`, CANVAS_WIDTH - 15, 25);

        // Start screen overlay
        if (gameStateRef.current === 'start') {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

            // Title
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 40px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('DUCK RACER', CANVAS_WIDTH / 2, 180);

            // Start instruction
            ctx.font = 'bold 18px Arial';
            ctx.fillStyle = '#4CAF50';
            ctx.fillText('Press SPACE to Start', CANVAS_WIDTH / 2, 240);

            // Controls - compact list
            ctx.font = '14px Arial';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillText('← → Lane  |  ↑ Turbo Jump  |  ↓ Drift', CANVAS_WIDTH / 2, 290);
        }

        // Game over overlay
        if (gameStateRef.current === 'gameover') {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

            // Game Over title
            ctx.fillStyle = '#FF5252';
            ctx.font = 'bold 50px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, 180);

            // Stats panel
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.beginPath();
            ctx.roundRect(CANVAS_WIDTH / 2 - 100, 230, 200, 100, 12);
            ctx.fill();

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(CANVAS_WIDTH / 2 - 100, 230, 200, 100, 12);
            ctx.stroke();

            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 18px Arial';
            ctx.fillText(`Distance: ${Math.floor(distanceRef.current)}m`, CANVAS_WIDTH / 2, 255);

            ctx.fillStyle = '#FFD700';
            ctx.fillText(`Coins: ${coinsRef.current}`, CANVAS_WIDTH / 2, 283);

            ctx.fillStyle = '#4CAF50';
            ctx.fillText(`Score: ${scoreRef.current}`, CANVAS_WIDTH / 2, 311);

            // Click to restart
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = '14px Arial';
            ctx.fillText('Click to Play Again', CANVAS_WIDTH / 2, 360);
        }
    };

    const drawRoadEdgesWithPerspective = (ctx: CanvasRenderingContext2D) => {
        // Yellow edges that taper in thickness (thick at bottom, thin at horizon)
        ctx.fillStyle = '#FDD835';

        // Left edge tapering
        ctx.beginPath();
        // Outer line
        ctx.moveTo(CANVAS_WIDTH / 2 - BOTTOM_ROAD_WIDTH / 2 - 6, CANVAS_HEIGHT);
        ctx.lineTo(CANVAS_WIDTH / 2 - HORIZON_ROAD_WIDTH / 2 - 2, VANISHING_POINT_Y);
        // Inner line
        ctx.lineTo(CANVAS_WIDTH / 2 - HORIZON_ROAD_WIDTH / 2, VANISHING_POINT_Y);
        ctx.lineTo(CANVAS_WIDTH / 2 - BOTTOM_ROAD_WIDTH / 2, CANVAS_HEIGHT);
        ctx.closePath();
        ctx.fill();

        // Right edge tapering
        ctx.beginPath();
        // Inner line
        ctx.moveTo(CANVAS_WIDTH / 2 + BOTTOM_ROAD_WIDTH / 2, CANVAS_HEIGHT);
        ctx.lineTo(CANVAS_WIDTH / 2 + HORIZON_ROAD_WIDTH / 2, VANISHING_POINT_Y);
        // Outer line
        ctx.lineTo(CANVAS_WIDTH / 2 + HORIZON_ROAD_WIDTH / 2 + 2, VANISHING_POINT_Y);
        ctx.lineTo(CANVAS_WIDTH / 2 + BOTTOM_ROAD_WIDTH / 2 + 6, CANVAS_HEIGHT);
        ctx.closePath();
        ctx.fill();

        // Inner yellow accent (thinner) - kept as stroke for crispness
        ctx.strokeStyle = 'rgba(253, 216, 53, 0.3)';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(CANVAS_WIDTH / 2 - BOTTOM_ROAD_WIDTH / 2 + 8, CANVAS_HEIGHT);
        ctx.lineTo(CANVAS_WIDTH / 2 - HORIZON_ROAD_WIDTH / 2 + 3, VANISHING_POINT_Y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(CANVAS_WIDTH / 2 + BOTTOM_ROAD_WIDTH / 2 - 8, CANVAS_HEIGHT);
        ctx.lineTo(CANVAS_WIDTH / 2 + HORIZON_ROAD_WIDTH / 2 - 3, VANISHING_POINT_Y);
        ctx.stroke();
    };

    const drawLaneDividersWithPerspective = (ctx: CanvasRenderingContext2D) => {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineCap = 'round';

        for (let i = 1; i < LANE_COUNT; i++) {
            const ratio = i / LANE_COUNT;

            // Calculate positions with perspective
            const bottomX = CANVAS_WIDTH / 2 + (ratio - 0.5) * BOTTOM_ROAD_WIDTH;
            const horizonX = CANVAS_WIDTH / 2 + (ratio - 0.5) * HORIZON_ROAD_WIDTH;

            // Animated dashed line (moves with speed for motion effect)
            const dashOffset = (scoreRef.current * 5) % 40;

            // Draw dashes with perspective-correct sizing
            const totalDistance = CANVAS_HEIGHT - VANISHING_POINT_Y;
            const dashLength = 25;
            const gapLength = 15;
            const totalDashCycle = dashLength + gapLength;

            for (let d = -dashOffset; d < totalDistance; d += totalDashCycle) {
                const progress = d / totalDistance;
                if (progress < 0 || progress > 1) continue;

                const startY = VANISHING_POINT_Y + d;
                const endY = Math.min(startY + dashLength, CANVAS_HEIGHT);

                const startX = horizonX + (bottomX - horizonX) * (d / totalDistance);
                const endX = horizonX + (bottomX - horizonX) * ((d + dashLength) / totalDistance);

                // Line width scales with distance
                ctx.lineWidth = 2 + progress * 2;

                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }
        }
    };

    const drawHeadlightBeam = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, isPlayer: boolean = false) => {
        ctx.save();
        const beamLength = isPlayer ? 300 : 150;
        const beamWidthEnd = width * 2.5;

        // Create gradient for the light beam
        const gradient = ctx.createLinearGradient(x, y, x, y - beamLength);
        gradient.addColorStop(0, 'rgba(255, 255, 200, 0.4)'); // Bright at source
        gradient.addColorStop(1, 'rgba(255, 255, 200, 0)');   // Fade out

        ctx.fillStyle = gradient;
        ctx.globalCompositeOperation = 'screen'; // Blend mode for light

        // Left Beam
        ctx.beginPath();
        ctx.moveTo(x - width / 3, y - 10);
        ctx.lineTo(x - width / 3 - beamWidthEnd / 2, y - beamLength);
        ctx.lineTo(x - width / 3 + beamWidthEnd / 2, y - beamLength);
        ctx.closePath();
        ctx.fill();

        // Right Beam
        ctx.beginPath();
        ctx.moveTo(x + width / 3, y - 10);
        ctx.lineTo(x + width / 3 - beamWidthEnd / 2, y - beamLength);
        ctx.lineTo(x + width / 3 + beamWidthEnd / 2, y - beamLength);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    };

    const drawCar = (
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        width: number,
        height: number,
        color: string,
        type: 'sport' | 'sedan' | 'truck',
        angle: number = 0
    ) => {
        // Draw Headlights beams first (so they are behind the car if coming towards, or in front if player)
        // Actually for obstacles coming towards camera, beams should be drawn AFTER? 
        // No, we are looking from behind player.
        // Player beams go UP (forward). Obstacles... usually face us?
        // In this game visuals, obstacles are cars DRIVING AWAY usually (rears visible)? 
        // Or coming towards? The sprite logic suggests we see "Headlights" (Yellow/White).
        // If we see headlights, they are coming AT us.
        // If coming AT us, beams should point DOWN.
        // BUT logic suggests player overtakes them? 
        // Let's assume obstacles are facing AWAY (we see taillights) to make sense of "Overtaking".
        // BUT current visuals draw "Headlights" (Yellow).
        // Let's stick to "Headlights" visual for now as per previous code, implies they might be oncoming or just "Car front" icon.
        // If they are oncoming, we crash.
        // If we implement BEAMS, player beam goes UP.
        // Obstacle beams (if oncoming) go DOWN. 
        // Let's make obstacles render RED Taillights if they are traffic we overtake.
        // User asked for "Faros... dar un poco de luz".
        // Let's do: Player => Headlights UP. Obstacles => Red Taillights (glow) DOWN?
        // Or Obstacles are oncoming? "Esquivarlos".
        // Let's assume Oncoming for drama in Tunnel.

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 5;

        // Dimensions
        const bodyHeight = height * 0.6;
        const roofHeight = height * 0.4;
        const roofWidth = width * 0.6;

        // --- DRAW LIGHT BEAMS (If enabled) ---
        // Player: Beams pointing UP (Forward)
        if (color === '#FFD700') { // Check if player (Gold)
            // We need to draw beams in world space, but we are in rotated local space.
            // Actually beams should be drawn BEFORE car body to not overlap it weirdly?
            // Helper function called separately might be better, but inside here works if we manage Z.
            // Let's draw beams here, pointing -Y.
        }

        // Base Chassis
        const gradient = ctx.createLinearGradient(-width / 2, -height, width / 2, 0);
        gradient.addColorStop(0, color);
        gradient.addColorStop(0.5, color);
        gradient.addColorStop(1, 'black'); // Shading
        ctx.fillStyle = gradient;

        if (type === 'truck') {
            // Boxy truck shape
            ctx.fillRect(-width / 2, -height, width, height);
            // Windshield
            ctx.fillStyle = '#87CEEB';
            ctx.fillRect(-width / 2 + 2, -height + 5, width - 4, height * 0.4);
            // Grille
            ctx.fillStyle = '#333';
            for (let i = 0; i < 3; i++) {
                ctx.fillRect(-width / 2 + 5, -height * 0.5 + i * 10, width - 10, 5);
            }
        } else {
            // Car shape (Sport/Sedan)
            // Main Body Lower
            ctx.beginPath();
            ctx.roundRect(-width / 2, -bodyHeight, width, bodyHeight, 8);
            ctx.fill();

            // Spoiler for Sport type
            if (type === 'sport') {
                ctx.fillStyle = '#333';
                ctx.fillRect(-width / 2 - 2, -bodyHeight + 5, width + 4, 8); // Wing
                ctx.fillStyle = color; // Wing supports
                ctx.fillRect(-width / 4, -bodyHeight + 5, 5, 5);
                ctx.fillRect(width / 4 - 5, -bodyHeight + 5, 5, 5);
            }

            // Cabin / Roof
            ctx.fillStyle = type === 'sport' ? 'rgba(20, 20, 20, 0.9)' : color; // Sport has dark glass roof

            // Sports car has streamlined cabin
            const roofWidthAdjusted = type === 'sport' ? roofWidth * 0.9 : roofWidth;
            const roofHeightAdjusted = type === 'sport' ? roofHeight * 0.8 : roofHeight;

            ctx.beginPath();
            ctx.roundRect(-roofWidthAdjusted / 2, -height + (type === 'sport' ? 10 : 0), roofWidthAdjusted, roofHeightAdjusted + 5, 6);
            ctx.fill();

            // Windshield
            ctx.fillStyle = '#87CEEB';
            ctx.beginPath();
            ctx.roundRect(-roofWidthAdjusted / 2 + 3, -height + (type === 'sport' ? 12 : 2), roofWidthAdjusted - 6, roofHeightAdjusted * 0.7, 4);
            ctx.fill();
        }

        // Headlights / Taillights
        // If player (Gold): Headlights (Yellow/White)
        // If traffic: Headlights (Yellow/White) implies oncoming

        const isPlayer = color === '#FFD700';

        ctx.fillStyle = isPlayer || type !== 'sport' ? '#FFFFA0' : '#FFFFA0'; // Everyone has headlights for now
        ctx.shadowBlur = 15;
        ctx.shadowColor = isPlayer ? '#FFFFA0' : '#FFFFA0';

        const lightY = -bodyHeight * 0.6;
        const lightSize = width * 0.18;

        // Left Light
        ctx.beginPath();
        ctx.ellipse(-width / 3, lightY, lightSize / 2, lightSize, 0, 0, Math.PI * 2);
        ctx.fill();

        // Right Light
        ctx.beginPath();
        ctx.ellipse(width / 3, lightY, lightSize / 2, lightSize, 0, 0, Math.PI * 2);
        ctx.fill();

        // Wheels (Black tires)
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#111';
        const wheelW = width * 0.2;
        const wheelH = height * 0.3;

        ctx.fillRect(-width / 2 - 2, -wheelH, wheelW, wheelH); // Front Left
        ctx.fillRect(width / 2 - wheelW + 2, -wheelH, wheelW, wheelH); // Front Right

        // Grille (if truck or sedan)
        if (type !== 'sport') {
            ctx.fillStyle = '#333';
            ctx.fillRect(-width / 4, -bodyHeight * 0.4, width / 2, bodyHeight * 0.3);
        }

        ctx.restore();
    };

    const drawObstacles = (ctx: CanvasRenderingContext2D, layer: 'background' | 'foreground') => {
        // Sort far to near
        const sorted = [...obstaclesRef.current].sort((a, b) => b.z - a.z);

        const filtered = sorted.filter(o =>
            layer === 'background' ? o.z >= -10 : o.z < -10
        );

        for (const obstacle of filtered) {
            const progress = 1 - (obstacle.z / OBSTACLE_SPAWN_DISTANCE);
            const scale = 0.05 + (progress * 0.95);
            const screenX = getLaneXAt(obstacle.lane, obstacle.z);
            const screenY = getScreenY(obstacle.z); // Center bottom position
            const size = 50 * scale;

            // Fade opacity near horizon
            let opacity = 1.0;
            if (obstacle.z > 350) {
                opacity = Math.max(0, 1.0 - ((obstacle.z - 350) / 150));
            }
            ctx.globalAlpha = opacity;

            if (obstacle.type === 'coin') {
                // 3D coin with lighting from top-left
                const coinRadius = size / 2;
                const gradient = ctx.createRadialGradient(
                    screenX - coinRadius * 0.35, screenY - coinRadius * 0.35, 0,
                    screenX, screenY, coinRadius
                );
                gradient.addColorStop(0, '#FFFEF0'); // Bright highlight
                gradient.addColorStop(0.3, '#FFD700'); // Gold
                gradient.addColorStop(0.7, '#DAA520'); // Medium gold
                gradient.addColorStop(1, '#B8860B'); // Dark edge
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(screenX, screenY - size / 2, coinRadius, 0, Math.PI * 2); // Adjusted Y
                ctx.fill();

                // 3D rim
                ctx.strokeStyle = '#8B6914';
                ctx.lineWidth = 2.5 * scale;
                ctx.stroke();

                // Dollar sign
                ctx.font = `bold ${size * 0.5}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#8B6914';
                ctx.fillText('$', screenX, screenY - size / 2);
            } else if (obstacle.type === 'sign') {
                // Draw "Llegando al calentón" sign
                // Green board
                const signWidth = size * 4;
                const signHeight = size * 1.5;
                const poleHeight = size * 3;

                // Pole 3D
                ctx.fillStyle = '#777';
                ctx.fillRect(screenX - 2, screenY - poleHeight, 4, poleHeight);

                // Board Back (Shadow/Thickness)
                ctx.fillStyle = '#0a3d0a';
                ctx.fillRect(screenX - signWidth / 2 + 2, screenY - poleHeight - signHeight + 2, signWidth, signHeight);

                // Board Front
                ctx.fillStyle = '#105c10'; // Highway Green
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.rect(screenX - signWidth / 2, screenY - poleHeight - signHeight, signWidth, signHeight);
                ctx.fill();
                ctx.stroke();

                // Text
                ctx.fillStyle = 'white';
                ctx.font = `bold ${size * 0.35}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const signY = screenY - poleHeight - signHeight / 2;

                const texts = obstacle.signText || ['LLEGANDO AL', 'CALENTÓN 🔥'];

                ctx.fillText(texts[0], screenX, signY - size * 0.2);
                ctx.fillText(texts[1], screenX, signY + size * 0.2);

            } else if (obstacle.type === 'low') {
                // Low obstacle = Sedan
                drawCar(ctx, screenX, screenY, size * 1.2, size * 0.8, '#E74C3C', 'sedan');
            } else {
                // High obstacle = Truck
                drawCar(ctx, screenX, screenY, size * 1.4, size * 1.2, '#2C3E50', 'truck');
            }
            ctx.globalAlpha = 1.0;
        }
    };

    const drawPlayer = (ctx: CanvasRenderingContext2D) => {
        const player = playerRef.current;
        const laneX = getLaneXAt(player.lane, 0);
        const groundY = CANVAS_HEIGHT - 10;
        const playerY = groundY + player.y;

        const baseSize = PLAYER_SIZE * 1.5; // Bigger car

        // Tilt angle for jumping
        const jumpAngle = player.y < 0 ? -Math.PI / 12 : 0;

        // Draw the DuckMobile!

        // Check if we are in tunnel for headlights
        // We use the same 'cycle' logic as in draw(), but calculated locally or passed
        // For simplicity, recalculate basic state:
        const distance = distanceRef.current;
        const cycle = distance % 3000;
        let darkness = 0;
        if (cycle > 2000) darkness = 1;
        else if (cycle > 1800) darkness = (cycle - 1800) / 200;
        else if (cycle < 200) darkness = 1 - (cycle / 200);

        if (darkness > 0) {
            // Draw Light Beams for Player (Behind car, but additive)
            drawHeadlightBeam(ctx, laneX, playerY - baseSize * 0.3, baseSize * 1.2, true);
        }

        drawCar(
            ctx,
            laneX,
            playerY,
            baseSize * 1.2, // Width
            baseSize * 0.8, // Height
            '#FFD700', // Gold/Yellow Duck Color
            'sport',
            jumpAngle
        );
    };



    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', minHeight: '100vh' }}>

            <h1 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>🏎️ Duck Racer</h1>

            <div style={{ position: 'relative', marginBottom: '2rem' }}>
                <canvas
                    ref={canvasRef}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    style={{
                        border: '2px solid var(--card-border)',
                        borderRadius: '8px',
                        background: '#1a1a2e',
                        cursor: gameState === 'gameover' ? 'pointer' : 'default',
                        touchAction: 'none',
                        userSelect: 'none',
                        WebkitTapHighlightColor: 'transparent'
                    }}
                    onClick={gameState === 'gameover' ? resetToStart : undefined}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchCancel}
                    onContextMenu={(e) => e.preventDefault()}
                />


                {gameState === 'gameover' && (
                    <button
                        onClick={resetToStart}
                        className="btn btn-primary"
                        style={{
                            position: 'absolute',
                            bottom: '20px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            padding: '12px 24px'
                        }}
                    >
                        Jugar de Nuevo
                    </button>
                )}
            </div>

            <div style={{ width: '400px', background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                <h2 style={{ marginBottom: '1rem', textAlign: 'center', color: 'var(--text-primary)' }}>🏆 Mejores Puntuaciones</h2>
                {leaderboard.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No hay puntuaciones aún</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {leaderboard.map((entry, index) => (
                            <div
                                key={index}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: '0.75rem',
                                    background: index < 3 ? 'rgba(255, 215, 0, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255, 255, 255, 0.1)'
                                }}
                            >
                                <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>
                                    {index + 1}. {entry.name}
                                </span>
                                <span style={{ color: 'var(--text-secondary)' }}>
                                    {entry.score} pts • 💰{entry.coins}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RunnerGame;
