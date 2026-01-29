import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, increment, setDoc, getDoc } from 'firebase/firestore';

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
    const [isConnected, setIsConnected] = useState(false);
    const [currentSkin, setCurrentSkin] = useState<'duck' | 'apple' | 'goat' | 'principito'>('duck');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Reference to the globalstats document
        const statsRef = doc(db, "stats", "global");

        // Subscribe to real-time updates
        const unsubscribe = onSnapshot(statsRef, (docSnap) => {
            setError(null);
            if (docSnap.exists()) {
                setCount(docSnap.data().count || 0);
                setIsConnected(true);
            } else {
                // If document doesn't exist, initialize it
                setDoc(statsRef, { count: 0 }).catch(err => {
                    console.error("Init error:", err);
                    setError("No se pudo inicializar: " + err.message);
                });
                setCount(0);
                setIsConnected(true);
            }
        }, (err) => {
            console.error("Error connecting to Firebase:", err);
            setIsConnected(false);
            setError("Error de conexión: " + err.message);
        });

        return () => unsubscribe();
    }, []);

    const handleClick = async (e: React.MouseEvent) => {
        // Optimistic UI update for particle (actual count comes from listener)
        createParticle(e.clientX, e.clientY);
        playQuack();

        try {
            const statsRef = doc(db, "stats", "global");
            // Increment the count atomically in Firestore
            await updateDoc(statsRef, {
                count: increment(1)
            });
        } catch (error) {
            console.error("Error updating count:", error);
            // Retry initialization if it failed before
            try {
                const statsRef = doc(db, "stats", "global");
                const docSnap = await getDoc(statsRef);
                if (!docSnap.exists()) {
                    await setDoc(statsRef, { count: 1 });
                }
            } catch (err) {
                console.error("Retry failed", err);
            }
        }
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

    const getSkinEmoji = () => {
        switch (currentSkin) {
            case 'duck': return '🦆';
            case 'apple': return '🍎';
            case 'goat': return '🐐';
            case 'principito': return '🤴'; // Placeholder for Principito image/emoji
            default: return '🦆';
        }
    };

    // If you have images, replace the emoji return with an <img> tag in the render
    const renderSkin = () => {
        // Using <img> if these assets exist in public/
        if (['goat', 'apple', 'principito'].includes(currentSkin)) {
            // We'll use emojis for simplicity if images are missing or complex to layout, 
            // but the user had specific pngs. Let's try to use them if they match the backup logic.
            // Based on file list: golden-apple.png, goat.png, principito.png exist.
            if (currentSkin === 'apple') return <img src="/golden-apple.png" alt="Golden Apple" style={{ width: '200px', height: '200px', objectFit: 'contain' }} draggable={false} />;
            if (currentSkin === 'goat') return <img src="/goat.png" alt="Goat" style={{ width: '200px', height: '200px', objectFit: 'contain' }} draggable={false} />;
            if (currentSkin === 'principito') return <img src="/principito.png" alt="Principito" style={{ width: '200px', height: '200px', objectFit: 'contain' }} draggable={false} />;
        }
        return <div style={{ fontSize: '10rem' }}>{getSkinEmoji()}</div>;
    };


    return (
        <section className="mode-section active">
            <div className="container" style={{ textAlign: 'center' }}>
                <header className="header">
                    <h1 className="title">💰 Golden Duck Clicker</h1>
                    <p className="subtitle">Contador Mundial Real-time</p>
                </header>

                <div className="clicker-content">
                    <div className="global-counter-panel" style={{ marginBottom: '2rem' }}>
                        <h3 style={{ color: 'var(--text-secondary)' }}>CLICKS GLOBALES</h3>
                        <div className="global-counter" style={{ fontSize: '4rem', fontWeight: 'bold', color: '#FFD700', textShadow: '0 0 20px rgba(255, 215, 0, 0.5)' }}>
                            {isConnected ? count.toLocaleString() : 'Conectando...'}
                        </div>
                        {error && (
                            <div style={{ color: '#ff5252', marginTop: '1rem', fontSize: '0.9rem', background: 'rgba(255,0,0,0.1)', padding: '0.5rem', borderRadius: '4px' }}>
                                Error: {error}
                            </div>
                        )}
                    </div>

                    <div
                        className="golden-duck-container"
                        style={{ margin: '0 auto 2rem auto', cursor: 'pointer', userSelect: 'none', transition: 'transform 0.1s' }}
                        onMouseDown={(e) => {
                            e.currentTarget.style.transform = 'scale(0.95)';
                            handleClick(e);
                        }}
                        onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        {renderSkin()}
                    </div>

                    {/* Skin Selector - MOVED BELOW CHARACTER */}
                    <div className="skin-selector" style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
                        <button className={`btn ${currentSkin === 'duck' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCurrentSkin('duck')} style={{ width: 'auto' }}>🦆 Pato</button>
                        <button className={`btn ${currentSkin === 'apple' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCurrentSkin('apple')} style={{ width: 'auto' }}>🍎 Manzana</button>
                        <button className={`btn ${currentSkin === 'goat' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCurrentSkin('goat')} style={{ width: 'auto' }}>🐐 Cabra</button>
                        <button className={`btn ${currentSkin === 'principito' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setCurrentSkin('principito')} style={{ width: 'auto' }}>🤴 Principito</button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ClickerGame;
