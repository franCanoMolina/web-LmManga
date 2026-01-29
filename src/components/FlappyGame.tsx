import React, { useRef, useEffect, useState, useCallback } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';

// Constants
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const BIRD_SIZE = 30;
const PIPE_WIDTH = 60;
const PIPE_GAP = 150;
const GRAVITY = 0.5;
const JUMP_STRENGTH = -8;
const PIPE_SPEED = 3;

interface Bird {
    x: number;
    y: number;
    velocity: number;
}

interface Pipe {
    x: number;
    topHeight: number;
    bottomY: number;
    passed: boolean;
}

const FlappyGame: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [gameState, setGameState] = useState<'start' | 'playing' | 'gameover'>('start');
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [selectedChar, setSelectedChar] = useState<'duck' | 'fran' | 'goat'>('duck');
    const [error, setError] = useState<string | null>(null);

    // Leaderboard State
    const [leaderboard, setLeaderboard] = useState<{ name: string, score: number }[]>([]);
    const [playerName, setPlayerName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // UI State
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const [unlockMessage, setUnlockMessage] = useState<string | null>(null);

    // Mutable Game State
    const gameStateRef = useRef<'start' | 'playing' | 'gameover'>('start');
    const birdRef = useRef<Bird>({ x: 100, y: 300, velocity: 0 });
    const pipesRef = useRef<Pipe[]>([]);
    const frameRef = useRef<number>(0);
    const scoreRef = useRef(0);
    const franImgRef = useRef<HTMLImageElement>(new Image());
    const duckImgRef = useRef<HTMLImageElement>(new Image());
    const goatImgRef = useRef<HTMLImageElement>(new Image());
    const selectedCharRef = useRef<'duck' | 'fran' | 'goat'>('duck');

    useEffect(() => {
        selectedCharRef.current = selectedChar;
    }, [selectedChar]);

    useEffect(() => {
        franImgRef.current.src = '/fran.png';
        duckImgRef.current.src = '/duck-character.png';
        goatImgRef.current.src = '/goat.png';
        const savedHigh = localStorage.getItem('flappyHighScore');
        if (savedHigh) setHighScore(parseInt(savedHigh));

        fetchLeaderboard();

        // Start LOOP immediately for floating animation
        gameStateRef.current = 'start';
        loop();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (gameStateRef.current === 'start' && !isSelectorOpen && !unlockMessage) {
                    startGame();
                } else if (gameStateRef.current === 'playing') {
                    jump();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        };
    }, [isSelectorOpen, unlockMessage]);

    const fetchLeaderboard = async () => {
        try {
            setError(null);
            const q = query(
                collection(db, "leaderboard"),
                orderBy("score", "desc"),
                limit(5)
            );
            const querySnapshot = await getDocs(q);
            const leaders: { name: string, score: number }[] = [];
            querySnapshot.forEach((doc) => {
                leaders.push(doc.data() as { name: string, score: number });
            });
            setLeaderboard(leaders);
        } catch (err: any) {
            console.error("Error fetching leaderboard", err);
            setError("Error cargando ranking: " + err.message);
        }
    };

    const submitScore = async () => {
        if (!playerName.trim() || score <= 0) return;
        setIsSubmitting(true);
        try {
            setError(null);
            await addDoc(collection(db, "leaderboard"), {
                name: playerName,
                score: score,
                timestamp: serverTimestamp()
            });
            await fetchLeaderboard();
            setPlayerName(''); // Clear input but keep game over screen until restart
        } catch (err: any) {
            console.error("Error submitting score", err);
            setError("Error guardando puntos: " + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Start the game (Transition from Idle -> Playing)
    const startGame = () => {
        if (pipesRef.current.length === 0) {
            addPipe(CANVAS_WIDTH);
            addPipe(CANVAS_WIDTH + 250);
        }
        setGameState('playing');
        gameStateRef.current = 'playing';
        birdRef.current.velocity = JUMP_STRENGTH;
    };

    // Reset to Idle State (Levitating)
    const resetToStart = () => {
        birdRef.current = { x: 100, y: 300, velocity: 0 };
        pipesRef.current = [];
        addPipe(CANVAS_WIDTH);
        addPipe(CANVAS_WIDTH + 250);
        scoreRef.current = 0;
        setScore(0);

        setGameState('start');
        gameStateRef.current = 'start';

        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        loop();
    };

    const addPipe = (x: number) => {
        const minHeight = 100;
        const maxHeight = CANVAS_HEIGHT - PIPE_GAP - minHeight;
        const topHeight = Math.floor(Math.random() * (maxHeight - minHeight)) + minHeight;
        pipesRef.current.push({
            x,
            topHeight,
            bottomY: topHeight + PIPE_GAP,
            passed: false
        });
    };

    const jump = useCallback(() => {
        if (gameStateRef.current === 'playing') {
            birdRef.current.velocity = JUMP_STRENGTH;
        } else if (gameStateRef.current === 'start') {
            // Only start if modals are closed (handled in useEffect/click) but safe to double check or let Start button handle it
            // startGame(); // Removed to enforce button click or space when no modals
        }
    }, []);

    const loop = () => {
        // Run loop for both playing and start (for animation)
        if (gameStateRef.current !== 'playing' && gameStateRef.current !== 'start') return;

        updatePhysics();
        draw();

        if (gameStateRef.current === 'playing' && checkCollision()) {
            endGame();
        } else {
            frameRef.current = requestAnimationFrame(loop);
        }
    };

    const updatePhysics = () => {
        const bird = birdRef.current;

        if (gameStateRef.current === 'start') {
            // Levitating Animation
            const time = Date.now() / 300;
            bird.y = 300 + Math.sin(time) * 10;
            bird.velocity = 0; // Reset velocity
            return; // Skip pipes and gravity
        }

        bird.velocity += GRAVITY;
        bird.y += bird.velocity;

        // Pipes
        for (let i = pipesRef.current.length - 1; i >= 0; i--) {
            const pipe = pipesRef.current[i];
            pipe.x -= PIPE_SPEED;

            if (!pipe.passed && pipe.x + PIPE_WIDTH < bird.x) {
                pipe.passed = true;
                scoreRef.current += 1;
                setScore(scoreRef.current);
            }

            if (pipe.x < -PIPE_WIDTH) {
                pipesRef.current.splice(i, 1);
            }
        }

        if (pipesRef.current.length > 0 && pipesRef.current[pipesRef.current.length - 1].x < CANVAS_WIDTH - 250) {
            addPipe(CANVAS_WIDTH);
        }
    };

    const checkCollision = () => {
        const bird = birdRef.current;
        if (bird.y + BIRD_SIZE >= CANVAS_HEIGHT || bird.y <= 0) return true;

        const bx = bird.x + 5;
        const by = bird.y + 5;
        const bw = BIRD_SIZE - 10;
        const bh = BIRD_SIZE - 10;

        for (const pipe of pipesRef.current) {
            if (bx < pipe.x + PIPE_WIDTH && bx + bw > pipe.x &&
                (by < pipe.topHeight || by + bh > pipe.bottomY)) {
                return true;
            }
        }
        return false;
    };

    const endGame = () => {
        gameStateRef.current = 'gameover';
        setGameState('gameover');
        cancelAnimationFrame(frameRef.current);

        if (scoreRef.current > highScore) {
            setHighScore(scoreRef.current);
            localStorage.setItem('flappyHighScore', scoreRef.current.toString());
        }
        draw();
        // Auto-refresh leaderboard
        fetchLeaderboard();
    };

    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Pipes
        pipesRef.current.forEach(pipe => {
            // Gradient for 3D effect (Mario Style Green)
            const gradient = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_WIDTH, 0);
            gradient.addColorStop(0, '#0d570d');   // Dark edge
            gradient.addColorStop(0.1, '#2ba82b'); // Main color
            gradient.addColorStop(0.4, '#89e089'); // Highlight
            gradient.addColorStop(0.8, '#2ba82b'); // Main color
            gradient.addColorStop(1, '#0d570d');   // Dark edge

            ctx.fillStyle = gradient;
            ctx.strokeStyle = '#003300';
            ctx.lineWidth = 2;

            const capHeight = 24;
            const inset = 4; // Body is slightly narrower than cap

            // --- Top Pipe ---
            // Body (from top to cap)
            ctx.fillRect(pipe.x + inset, 0, PIPE_WIDTH - (inset * 2), pipe.topHeight - capHeight);
            ctx.strokeRect(pipe.x + inset, -2, PIPE_WIDTH - (inset * 2), pipe.topHeight - capHeight + 2);

            // Cap (Rim)
            ctx.fillRect(pipe.x, pipe.topHeight - capHeight, PIPE_WIDTH, capHeight);
            ctx.strokeRect(pipe.x, pipe.topHeight - capHeight, PIPE_WIDTH, capHeight);

            // --- Bottom Pipe ---
            // Cap (Rim)
            ctx.fillRect(pipe.x, pipe.bottomY, PIPE_WIDTH, capHeight);
            ctx.strokeRect(pipe.x, pipe.bottomY, PIPE_WIDTH, capHeight);

            // Body (from cap to bottom)
            ctx.fillRect(pipe.x + inset, pipe.bottomY + capHeight, PIPE_WIDTH - (inset * 2), CANVAS_HEIGHT - (pipe.bottomY + capHeight));
            ctx.strokeRect(pipe.x + inset, pipe.bottomY + capHeight, PIPE_WIDTH - (inset * 2), CANVAS_HEIGHT - (pipe.bottomY + capHeight) + 2);
        });

        // Bird
        const bird = birdRef.current;
        ctx.save();
        ctx.translate(bird.x + BIRD_SIZE / 2, bird.y + BIRD_SIZE / 2);

        // Simple rotation based on slight movement if floating
        let rotation = 0;
        if (gameStateRef.current === 'start') {
            rotation = Math.sin(Date.now() / 300) * 0.1; // Gentle sway
        } else {
            rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (bird.velocity * 0.1)));
        }
        ctx.rotate(rotation);

        if (selectedCharRef.current === 'fran') {
            ctx.drawImage(franImgRef.current, -BIRD_SIZE / 2, -BIRD_SIZE / 2, BIRD_SIZE, BIRD_SIZE);
        } else if (selectedCharRef.current === 'goat') {
            ctx.drawImage(goatImgRef.current, -BIRD_SIZE / 2, -BIRD_SIZE / 2, BIRD_SIZE, BIRD_SIZE);
        } else {
            // Detailed Canvas Duck
            // Body
            ctx.fillStyle = '#FFD700'; // Gold
            ctx.beginPath();
            ctx.ellipse(0, 5, BIRD_SIZE / 1.5, BIRD_SIZE / 1.8, 0, 0, Math.PI * 2);
            ctx.fill();

            // Head
            ctx.beginPath();
            ctx.arc(8, -8, BIRD_SIZE / 2.2, 0, Math.PI * 2);
            ctx.fill();

            // Wing (flapping effect based on velocity/rotation)
            ctx.fillStyle = '#F4C430'; // Darker gold/saffron
            ctx.beginPath();
            ctx.ellipse(-5, 5, BIRD_SIZE / 2.5, BIRD_SIZE / 3.5, -0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#DAA520';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Beak
            ctx.fillStyle = '#FF6B6B'; // Orange/Reddish
            ctx.beginPath();
            ctx.moveTo(15, -5);
            ctx.quadraticCurveTo(25, 0, 15, 5);
            ctx.lineTo(15, -5);
            ctx.fill();
            ctx.strokeStyle = '#C0392B';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Eye
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(12, -10, 6, 0, Math.PI * 2);
            ctx.fill();

            // Pupil
            ctx.fillStyle = 'black';
            ctx.beginPath();
            ctx.arc(14, -10, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Shine in eye
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(15, -11, 1, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // Floor
        ctx.fillStyle = '#D35400';
        ctx.fillRect(0, CANVAS_HEIGHT - 10, CANVAS_WIDTH, 10);
    };

    // Helper to get selected char name for display
    const getCharName = (char: string) => {
        switch (char) {
            case 'duck': return '🦆 Pato';
            case 'fran': return '🧔 Fran Exotik';
            case 'goat': return '🐐 Cabrita BB';
            default: return char;
        }
    };

    return (
        <section className="mode-section active">
            <div className="container" style={{ textAlign: 'center', maxWidth: '800px' }}>
                <header className="header" style={{ marginBottom: '1rem' }}>
                    <h1 className="title">🦆 Flappy Duck</h1>
                    <p className="subtitle">Puntuación: {score} | Récord: {highScore}</p>
                </header>

                {error && <div style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}

                <div style={{
                    display: 'flex',
                    gap: '2rem',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    maxWidth: '100%'
                }}>
                    {/* CANVAS CONTAINER */}
                    <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
                        <canvas
                            ref={canvasRef}
                            onClick={(e) => {
                                // Only jump on click if playing. If start/gameover, buttons/modals handle it.
                                if (gameState === 'playing') jump();
                            }}
                            width={400}
                            height={600}
                            style={{
                                border: '4px solid #fff',
                                borderRadius: '12px',
                                background: '#70c5ce',
                                cursor: 'pointer',
                                maxWidth: '100%',
                                height: 'auto',
                                WebkitTapHighlightColor: 'transparent',
                                touchAction: 'none',
                                userSelect: 'none',
                                outline: 'none'
                            }}
                        ></canvas>

                        {/* START SCREEN */}
                        {gameState === 'start' && !isSelectorOpen && !unlockMessage && (
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', borderRadius: '12px', backdropFilter: 'blur(2px)' }}>
                                <h2 style={{ color: 'white', marginBottom: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>¡Listo?</h2>

                                <div style={{ background: 'rgba(255,255,255,0.2)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', backdropFilter: 'blur(5px)', border: '1px solid rgba(255,255,255,0.3)' }}>
                                    <p style={{ color: 'white', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Personaje actual:</p>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                                        {getCharName(selectedChar)}
                                    </div>
                                </div>

                                <button
                                    className="btn btn-secondary"
                                    onClick={(e) => { e.stopPropagation(); setIsSelectorOpen(true); }}
                                    style={{ marginBottom: '1rem', background: 'white', color: '#70c5ce', border: 'none', fontWeight: 'bold', width: 'auto' }}
                                >
                                    🔄 Elegir Personaje
                                </button>

                                <button
                                    className="btn btn-primary"
                                    onClick={(e) => { e.stopPropagation(); startGame(); }}
                                    style={{
                                        fontSize: '1.5rem',
                                        padding: '1rem 3rem',
                                        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                                        animation: 'pulse 1.5s infinite'
                                    }}
                                >
                                    JUGAR
                                </button>
                            </div>
                        )}

                        {/* CHARACTER SELECTOR MODAL */}
                        {isSelectorOpen && (
                            <div style={{
                                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                                background: 'var(--card-bg)',
                                backdropFilter: 'blur(10px)',
                                zIndex: 20,
                                borderRadius: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                padding: '1.5rem'
                            }}>
                                <h3 style={{ color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Selecciona Personaje</h3>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', overflowY: 'auto', paddingBottom: '1rem' }}>

                                    {/* DUCK */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setSelectedChar('duck'); setIsSelectorOpen(false); }}
                                        style={{
                                            background: selectedChar === 'duck' ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.1)',
                                            border: '1px solid var(--card-border)',
                                            borderRadius: '12px',
                                            padding: '1rem',
                                            cursor: 'pointer',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                                            color: selectedChar === 'duck' ? 'white' : 'var(--text-primary)'
                                        }}
                                    >
                                        <span style={{ fontSize: '2.5rem' }}>🦆</span>
                                        <span style={{ fontWeight: 'bold' }}>Pato</span>
                                    </button>

                                    {/* FRAN */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setSelectedChar('fran'); setIsSelectorOpen(false); }}
                                        style={{
                                            background: selectedChar === 'fran' ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.1)',
                                            border: '1px solid var(--card-border)',
                                            borderRadius: '12px',
                                            padding: '1rem',
                                            cursor: 'pointer',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                                            color: selectedChar === 'fran' ? 'white' : 'var(--text-primary)'
                                        }}
                                    >
                                        <span style={{ fontSize: '2.5rem' }}>🧔</span>
                                        <span style={{ fontWeight: 'bold' }}>Fran</span>
                                    </button>

                                    {/* GOAT */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const clicks = parseInt(localStorage.getItem('golden_duck_clicks') || '0');
                                            if (clicks >= 500) {
                                                setSelectedChar('goat');
                                                setIsSelectorOpen(false);
                                            } else {
                                                setUnlockMessage("Tienes que llegar a 500 clicks en Golden Goal");
                                            }
                                        }}
                                        style={{
                                            background: selectedChar === 'goat' ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.05)',
                                            border: '1px solid var(--card-border)',
                                            borderRadius: '12px',
                                            padding: '1rem',
                                            cursor: 'pointer',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                                            opacity: (parseInt(localStorage.getItem('golden_duck_clicks') || '0') >= 500) ? 1 : 0.7,
                                            color: selectedChar === 'goat' ? 'white' : 'var(--text-primary)'
                                        }}
                                    >
                                        <span style={{ fontSize: '2.5rem' }}>{(parseInt(localStorage.getItem('golden_duck_clicks') || '0') >= 500) ? '🐐' : '🔒'}</span>
                                        <span style={{ fontWeight: 'bold' }}>Cabrita BB</span>
                                    </button>
                                </div>

                                <button
                                    className="btn btn-secondary"
                                    onClick={(e) => { e.stopPropagation(); setIsSelectorOpen(false); }}
                                    style={{ marginTop: 'auto' }}
                                >
                                    Cancelar
                                </button>
                            </div>
                        )}

                        {/* CUSTOM UNLOCK ALERT */}
                        {unlockMessage && (
                            <div style={{
                                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                                background: 'rgba(0,0,0,0.7)',
                                zIndex: 30,
                                borderRadius: '12px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '2rem'
                            }}>
                                <div style={{
                                    background: 'var(--card-bg)',
                                    backdropFilter: 'blur(10px)',
                                    border: '1px solid var(--card-border)',
                                    borderRadius: '16px',
                                    padding: '2rem',
                                    textAlign: 'center',
                                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                                    animation: 'slideIn 0.3s ease-out',
                                    width: '100%'
                                }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
                                    <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '1.2rem' }}>¡Bloqueado!</h3>
                                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{unlockMessage}</p>
                                    <button
                                        className="btn btn-primary"
                                        onClick={(e) => { e.stopPropagation(); setUnlockMessage(null); }}
                                        style={{ width: '100%' }}
                                    >
                                        Entendido
                                    </button>
                                </div>
                            </div>
                        )}

                        {gameState === 'gameover' && (
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                background: 'rgba(0,0,0,0.85)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'column',
                                borderRadius: '12px',
                                padding: '1rem',
                                zIndex: 10
                            }}>
                                <h2 style={{ color: '#ff5252', fontSize: '2rem' }}>GAME OVER</h2>
                                <p style={{ color: 'white', fontSize: '1.5rem', marginBottom: '1rem' }}>Puntos: {score}</p>

                                <div className="save-score-form" style={{
                                    marginBottom: '1rem',
                                    width: '100%',
                                    maxWidth: '250px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '15px'
                                }}>
                                    <input
                                        type="text"
                                        placeholder="Escribe Tu Nombre"
                                        value={playerName}
                                        onChange={(e) => setPlayerName(e.target.value)}
                                        className="option-input"
                                        style={{
                                            width: '100%',
                                            textAlign: 'center',
                                            color: 'black',
                                            background: 'white',
                                            padding: '12px',
                                            fontSize: '1rem',
                                            borderRadius: '8px',
                                            border: '2px solid transparent',
                                            marginBottom: '0',
                                            display: 'block'
                                        }}
                                        maxLength={15}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <button
                                        className="btn btn-primary"
                                        onClick={(e) => { e.stopPropagation(); submitScore(); }}
                                        disabled={isSubmitting || score === 0 || !playerName}
                                        style={{
                                            width: '100%',
                                            marginTop: '0',
                                            padding: '12px',
                                            fontSize: '1rem'
                                        }}
                                    >
                                        {isSubmitting ? 'Guardando...' : '💾 Guardar Puntos'}
                                    </button>
                                </div>

                                <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); resetToStart(); }} style={{ width: 'auto', marginTop: '1rem' }}>Jugar de Nuevo</button>
                            </div>
                        )}
                    </div>

                    {/* Leaderboard Panel */}
                    <div className="leaderboard-panel" style={{
                        background: 'var(--card-bg)',
                        padding: '1.5rem',
                        borderRadius: '16px',
                        border: '1px solid var(--card-border)',
                        width: '100%',
                        maxWidth: '300px',
                        textAlign: 'left',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                        maxHeight: '600px',
                        overflowY: 'auto'
                    }}>
                        <h3 style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: '0.5rem', marginBottom: '1rem', color: '#FFD700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>🏆</span> Top 5 Ranking
                        </h3>
                        {error && (
                            <div style={{ color: '#ff5252', marginBottom: '1rem', fontSize: '0.9rem', background: 'rgba(255,0,0,0.1)', padding: '0.5rem', borderRadius: '4px' }}>
                                {error}
                            </div>
                        )}
                        {leaderboard.length === 0 ? (
                            <p style={{ color: '#aaa', fontStyle: 'italic', textAlign: 'center' }}>Aún no hay récords</p>
                        ) : (
                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                {leaderboard.map((entry, idx) => (
                                    <li key={idx} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        padding: '0.75rem',
                                        background: idx === 0 ? 'rgba(255, 215, 0, 0.15)' : 'rgba(255,255,255,0.03)',
                                        borderRadius: '8px',
                                        marginBottom: '0.5rem',
                                        border: idx === 0 ? '1px solid rgba(255, 215, 0, 0.3)' : '1px solid transparent'
                                    }}>
                                        <span style={{ fontWeight: 600 }}>
                                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`} {entry.name}
                                        </span>
                                        <span style={{ color: '#FFD700', fontWeight: 'bold' }}>{entry.score}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                </div>
            </div>
        </section>
    );
};

export default FlappyGame;
