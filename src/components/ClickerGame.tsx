import React, { useState, useEffect } from 'react';

// Common sound utility (reused)
const playSound = (freq: number, type: 'sine' | 'square' | 'triangle' = 'sine', duration: number = 0.1) => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
};

const playQuack = () => {
    playClickSound(); // Fallback/Basic click sound
};

// More specific click sound
const playClickSound = () => {
    playSound(600, 'triangle', 0.1);
};


const ClickerGame: React.FC = () => {
    const [count, setCount] = useState(0);
    const [currentSkin, setCurrentSkin] = useState<'duck' | 'apple' | 'goat' | 'principito'>('duck');
    const [error, setError] = useState<string | null>(null);

    // Initialize from LocalStorage
    useEffect(() => {
        try {
            const savedCount = localStorage.getItem('golden_duck_clicks');
            if (savedCount) {
                setCount(parseInt(savedCount));
            } else {
                localStorage.setItem('golden_duck_clicks', '0');
                setCount(0);
            }
        } catch (err: any) {
            console.error("Error reading localStorage:", err);
            setError("Error cargando progreso local");
        }
    }, []);

    const handleClick = (e: React.MouseEvent) => {
        createParticle(e.clientX, e.clientY);
        playQuack();

        const newCount = count + 1;
        setCount(newCount);
        localStorage.setItem('golden_duck_clicks', newCount.toString());
    };

    const createParticle = (x: number, y: number) => {
        const particle = document.createElement('div');
        particle.textContent = "+1";
        particle.className = "click-particle";
        particle.style.position = 'fixed';
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.color = '#FFD700';
        particle.style.fontWeight = 'bold';
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '1000';
        particle.style.animation = 'floatUp 1s ease-out forwards';
        document.body.appendChild(particle);
        setTimeout(() => particle.remove(), 1000);
    };

    const getSkinImage = () => {
        // Return absolute paths to public assets
        switch (currentSkin) {
            case 'apple': return '/golden-apple.png';
            case 'goat': return '/goat.png';
            case 'principito': return '/principito.png';
            default: return '/duck.png';
        }
    };

    return (
        <section className="mode-section active">
            <div className="container" style={{ textAlign: 'center' }}>
                <header className="header">
                    <h1 className="title">Goal Duck Clicker</h1>
                    <p className="subtitle">¡Consigue clicks para desbloquear recompensas!</p>
                </header>

                <div className="clicker-content">
                    <div className="global-counter-panel" style={{ marginBottom: '2rem' }}>
                        <h3 style={{ color: 'var(--text-secondary)' }}>TUS CLICKS</h3>
                        <div className="global-counter" style={{ fontSize: '4rem', fontWeight: 'bold', color: '#FFD700', textShadow: '0 0 20px rgba(255, 215, 0, 0.5)' }}>
                            {count.toLocaleString()}
                        </div>
                        {error && (
                            <div style={{ color: '#ff5252', marginTop: '1rem', fontSize: '0.9rem', background: 'rgba(255,0,0,0.1)', padding: '0.5rem', borderRadius: '4px' }}>
                                Error: {error}
                            </div>
                        )}
                    </div>

                    <div
                        className="golden-duck-container"
                        onClick={handleClick}
                        style={{
                            cursor: 'pointer',
                            transition: 'transform 0.1s',
                            display: 'inline-block',
                            position: 'relative',
                            userSelect: 'none',
                            WebkitTapHighlightColor: 'transparent', // Fix mobile tap highlight
                            touchAction: 'manipulation' // Improve touch response
                        }}
                        onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                        onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        onTouchStart={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                        onTouchEnd={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        <div className="glow-effect" style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '300px',
                            height: '300px',
                            background: 'radial-gradient(circle, rgba(255, 215, 0, 0.4) 0%, transparent 70%)',
                            zIndex: -1,
                            pointerEvents: 'none',
                            animation: 'pulse 2s infinite'
                        }}></div>

                        {currentSkin === 'duck' ? (
                            <div style={{ fontSize: '10rem', lineHeight: 1, filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))' }}>
                                🦆
                            </div>
                        ) : (
                            <img
                                src={getSkinImage()}
                                alt="Goal Duck"
                                style={{
                                    width: '250px',
                                    height: '250px',
                                    objectFit: 'contain',
                                    filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))'
                                }}
                            />
                        )}
                    </div>

                    {/* Skin Selector Moved Below */}
                    <div className="skin-selector" style={{ marginTop: '3rem', display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className={`btn ${currentSkin === 'duck' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCurrentSkin('duck')} style={{ width: 'auto' }}>🦆 Pato</button>
                        <button className={`btn ${currentSkin === 'apple' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCurrentSkin('apple')} style={{ width: 'auto' }}>🍎 Manzana</button>
                        <button className={`btn ${currentSkin === 'goat' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCurrentSkin('goat')} style={{ width: 'auto' }}>🐐 Cabra</button>
                        <button className={`btn ${currentSkin === 'principito' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCurrentSkin('principito')} style={{ width: 'auto' }}>👑 Principito</button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ClickerGame;
