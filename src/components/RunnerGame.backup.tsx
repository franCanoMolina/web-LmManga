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
const DUCK_HEIGHT = 20;
const OBSTACLE_SPAWN_DISTANCE = 500;

// Perspective constants - Subway Surfer style (stronger convergence)
const VANISHING_POINT_Y = CANVAS_HEIGHT - 350; // Closer vanishing point
const HORIZON_ROAD_WIDTH = 80;  // Much narrower at horizon
const BOTTOM_ROAD_WIDTH = 280;  // Wider at bottom for strong effect
const PERSPECTIVE_SCALE = 200;  // Faster scaling

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

type GameState = 'start' | 'playing' | 'gameover';
type ObstacleType = 'low' | 'high' | 'coin';

interface Obstacle {
    lane: number;
    type: ObstacleType;
    z: number;
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
    const { user } = useAuth();
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
        // 30% chance to spawn a coin trail instead of regular obstacles
        if (Math.random() < 0.3) {
            spawnCoinTrail();
            return;
        }

        // Increased coin probability: 40% coins, 30% low, 30% high
        const types: ObstacleType[] = ['low', 'high', 'coin', 'coin'];

        // Randomly decide how many obstacles to spawn (1 or 2)
        // 60% chance of 1 obstacle, 40% chance of 2 obstacles
        const obstacleCount = Math.random() < 0.6 ? 1 : 2;

        // Track which lanes are already occupied in this spawn
        const occupiedLanes = new Set<number>();

        for (let i = 0; i < obstacleCount; i++) {
            const type = types[Math.floor(Math.random() * types.length)];

            // Pick a lane that's not already occupied in this spawn
            let lane;
            let attempts = 0;
            do {
                lane = Math.floor(Math.random() * LANE_COUNT);
                attempts++;
            } while (occupiedLanes.has(lane) && attempts < 10);

            // If we found a free lane, add the obstacle
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

            if (obstacle.z < -50) {
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
        speedRef.current = Math.min(BASE_SPEED * 2, BASE_SPEED + distanceRef.current / 200);
    };

    const checkCollisions = () => {
        const player = playerRef.current;
        const playerLane = Math.round(player.lane);

        for (const obstacle of obstaclesRef.current) {
            // Reduced Z-range from [-10, 10] to [-5, 3] for more accurate visual collision
            // This makes collision detection happen later, closer to actual visual contact
            if (obstacle.z <= 3 && obstacle.z >= -5) {
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

    const endGame = () => {
        gameStateRef.current = 'gameover';
        setGameState('gameover');
        cancelAnimationFrame(frameRef.current);

        if (scoreRef.current > highScore) {
            setHighScore(scoreRef.current);
        }

        submitScore();
        draw();
    };

    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clean sky gradient (simpler, less saturated)
        const skyGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        skyGradient.addColorStop(0, '#7FB3D5');
        skyGradient.addColorStop(0.6, '#A9CCE3');
        skyGradient.addColorStop(1, '#D6EAF8');
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Subtle sun (less prominent)
        ctx.fillStyle = 'rgba(255, 235, 150, 0.3)';
        ctx.beginPath();
        ctx.arc(340, 80, 50, 0, Math.PI * 2);
        ctx.fill();

        // Minimalist clouds (fewer, subtle)
        const cloudParallax = cloudOffsetRef.current % 800;
        drawMinimalCloud(ctx, 100 - cloudParallax * 0.3, 60, 30);
        drawMinimalCloud(ctx, 280 - cloudParallax * 0.3, 90, 35);

        // Simplified skyline (only background, very subtle)
        drawSimpleSkyline(ctx, buildingOffsetRef.current);

        // Ground base that extends to horizon with perspective
        const groundGradient = ctx.createLinearGradient(0, VANISHING_POINT_Y, 0, CANVAS_HEIGHT);
        groundGradient.addColorStop(0, '#6B8E23'); // Darker green at horizon
        groundGradient.addColorStop(0.5, '#7CB342');
        groundGradient.addColorStop(1, '#689F38');
        ctx.fillStyle = groundGradient;
        ctx.fillRect(0, VANISHING_POINT_Y, CANVAS_WIDTH, CANVAS_HEIGHT - VANISHING_POINT_Y);

        // LEFT side area (grass/barrier) with perspective
        ctx.fillStyle = '#5D4037'; // Brown barrier
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
        ctx.fillStyle = '#5D4037'; // Brown barrier
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
        roadGradient.addColorStop(0, '#666666'); // Lighter gray at horizon
        roadGradient.addColorStop(0.3, '#4A4A4A');
        roadGradient.addColorStop(0.7, '#3D3D3D');
        roadGradient.addColorStop(1, '#2E2E2E'); // Darker at bottom
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
            ctx.fillText('DUCK RUNNER', CANVAS_WIDTH / 2, 180);

            // Start instruction
            ctx.font = 'bold 18px Arial';
            ctx.fillStyle = '#4CAF50';
            ctx.fillText('Press SPACE to Start', CANVAS_WIDTH / 2, 240);

            // Controls - compact list
            ctx.font = '14px Arial';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillText('← → Change Lane  |  ↑ Jump  |  ↓ Duck', CANVAS_WIDTH / 2, 290);
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

    const drawObstacles = (ctx: CanvasRenderingContext2D, layer: 'background' | 'foreground') => {
        // Sort far to near
        const sorted = [...obstaclesRef.current].sort((a, b) => b.z - a.z);

        // Filter based on layer relative to player (player acts as Z=0 point mostly, with buffer)
        // Background: Obstacles that are behind or intersecting player
        // Foreground: Obstacles that have been clearly passed
        const filtered = sorted.filter(o =>
            layer === 'background' ? o.z >= -10 : o.z < -10
        );

        for (const obstacle of filtered) {
            // Improved scaling: from 0.05 at spawn to 1.0 at player position (more dramatic)
            const progress = 1 - (obstacle.z / OBSTACLE_SPAWN_DISTANCE);
            const scale = 0.05 + (progress * 0.95); // 0.05 to 1.0 for more drama
            const screenX = getLaneXAt(obstacle.lane, obstacle.z);
            const screenY = getScreenY(obstacle.z); // Use vertical compression
            const size = 45 * scale; // Slightly larger max size

            // Fade opacity near horizon
            let opacity = 1.0;
            if (obstacle.z > 350) {
                opacity = Math.max(0, 1.0 - ((obstacle.z - 350) / 150));
            }
            ctx.globalAlpha = opacity;

            // Enhanced shadow that grows with obstacle and provides depth cue
            const shadowAlpha = 0.4 * scale;
            const shadowWidth = size * 1.4;
            const groundY = CANVAS_HEIGHT - 10;
            ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
            ctx.beginPath();
            ctx.ellipse(screenX, groundY, shadowWidth / 2, 10 * scale, 0, 0, Math.PI * 2);
            ctx.fill();

            // Visual depth indicator - vertical line from obstacle to shadow
            if (obstacle.z < 150 && obstacle.type !== 'coin') {
                ctx.strokeStyle = `rgba(0, 0, 0, ${0.2 * scale})`;
                ctx.lineWidth = 2;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.moveTo(screenX, screenY);
                ctx.lineTo(screenX, groundY);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            if (obstacle.type === 'coin') {
                const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, size / 2);
                gradient.addColorStop(0, '#FFF8DC');
                gradient.addColorStop(0.5, '#FFD700');
                gradient.addColorStop(1, '#DAA520');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(screenX, screenY, size / 2, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = '#B8860B';
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.beginPath();
                ctx.arc(screenX - size / 6, screenY - size / 6, size / 8, 0, Math.PI * 2);
                ctx.fill();

                ctx.font = `${size * 0.5}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#B8860B';
                ctx.fillText('$', screenX, screenY);
            } else if (obstacle.type === 'low') {
                // Traffic cone
                const coneWidth = size * 0.8;
                const coneHeight = size * 1.2;
                const gradient = ctx.createLinearGradient(screenX - coneWidth / 2, screenY - coneHeight, screenX + coneWidth / 2, screenY);
                gradient.addColorStop(0, '#FF6B00');
                gradient.addColorStop(0.5, '#FF8C00');
                gradient.addColorStop(1, '#FF4500');
                ctx.fillStyle = gradient;

                ctx.beginPath();
                ctx.moveTo(screenX, screenY - coneHeight);
                ctx.lineTo(screenX - coneWidth / 2, screenY);
                ctx.lineTo(screenX + coneWidth / 2, screenY);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = '#FFFFFF';
                for (let i = 0; i < 2; i++) {
                    const stripeY = screenY - coneHeight + (i + 1) * (coneHeight / 3);
                    const stripeWidth = coneWidth * (1 - (i + 1) / 3);
                    ctx.fillRect(screenX - stripeWidth / 2, stripeY, stripeWidth, coneHeight / 10);
                }

                ctx.fillStyle = '#2C2C2C';
                ctx.fillRect(screenX - coneWidth / 1.5, screenY, coneWidth / 0.75, coneHeight / 8);
            } else {
                // Construction barrier
                const barrierWidth = size * 1.1;
                const barrierHeight = size * 1.8;
                const barrierX = screenX - barrierWidth / 2;
                const barrierY = screenY - barrierHeight;

                ctx.fillStyle = '#808080';
                ctx.fillRect(barrierX + 5, barrierY, 6, barrierHeight);
                ctx.fillRect(barrierX + barrierWidth - 11, barrierY, 6, barrierHeight);

                const panelHeight = barrierHeight / 3;
                for (let panel = 0; panel < 2; panel++) {
                    const panelY = barrierY + panel * (barrierHeight / 2.5);
                    ctx.fillStyle = '#FF6B00';
                    ctx.fillRect(barrierX, panelY, barrierWidth, panelHeight);

                    ctx.fillStyle = '#FFFFFF';
                    for (let i = 0; i < 4; i++) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(barrierX, panelY, barrierWidth, panelHeight);
                        ctx.clip();
                        ctx.fillRect(barrierX + (i * barrierWidth / 4), panelY - panelHeight / 2, barrierWidth / 8, panelHeight * 2);
                        ctx.restore();
                    }

                    ctx.strokeStyle = '#CC3700';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(barrierX, panelY, barrierWidth, panelHeight);
                }
            }
            ctx.globalAlpha = 1.0; // Reset opacity
        }
    };

    const drawPlayer = (ctx: CanvasRenderingContext2D) => {
        const player = playerRef.current;
        const laneX = getLaneXAt(player.lane, 0);
        const groundY = CANVAS_HEIGHT - 10; // Ground level position
        const playerY = groundY + player.y; // Player moves UP from ground (negative y)

        // Scale player up when jumping to simulate "closer to camera" / height
        // Increased to 1.4x for more dramatic "overpass" feel
        const jumpScale = 1 + (Math.abs(player.y) / 400) * 1.4;
        const baseSize = player.isDucking ? DUCK_HEIGHT : PLAYER_SIZE;
        const size = baseSize * jumpScale;

        // Dynamic shadow that changes with jump (on the ground)
        const shadowSize = player.isDucking ? baseSize / 2 : baseSize / 2;
        // Shadow separation: alpha drops faster, scale drops faster to show lift
        const shadowAlpha = 0.5 - Math.abs(player.y) / 150;
        const shadowScale = 1 - Math.abs(player.y) / 200;
        ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0.1, shadowAlpha)})`;
        ctx.beginPath();
        ctx.ellipse(laneX, groundY, shadowSize * Math.max(0.3, shadowScale), 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Player body with gradient
        const gradient = ctx.createLinearGradient(laneX - size / 2, playerY - size, laneX + size / 2, playerY);
        gradient.addColorStop(0, '#27ae60');
        gradient.addColorStop(0.5, '#2ecc71');
        gradient.addColorStop(1, '#1e8449');
        ctx.fillStyle = gradient;

        if (player.isDucking) {
            ctx.fillRect(laneX - size, playerY - size / 2, size * 2, size / 2);
            ctx.strokeStyle = '#145a32';
            ctx.lineWidth = 2;
            ctx.strokeRect(laneX - size, playerY - size / 2, size * 2, size / 2);
        } else {
            ctx.fillRect(laneX - size / 2, playerY - size, size, size);
            ctx.strokeStyle = '#145a32';
            ctx.lineWidth = 2;
            ctx.strokeRect(laneX - size / 2, playerY - size, size, size);
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        if (player.isDucking) {
            ctx.fillRect(laneX - size, playerY - size / 2, size * 2, 3);
        } else {
            ctx.fillRect(laneX - size / 2, playerY - size, size, 4);
        }

        ctx.font = `${size * (player.isDucking ? 0.8 : 1)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('🦆', laneX, playerY);
    };



    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', minHeight: '100vh' }}>
            <h1 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>🏃 Duck Runner</h1>

            <div style={{ position: 'relative', marginBottom: '2rem' }}>
                <canvas
                    ref={canvasRef}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    style={{
                        border: '2px solid var(--card-border)',
                        borderRadius: '8px',
                        background: '#1a1a2e',
                        cursor: gameState === 'gameover' ? 'pointer' : 'default'
                    }}
                    onClick={gameState === 'gameover' ? resetToStart : undefined}
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
