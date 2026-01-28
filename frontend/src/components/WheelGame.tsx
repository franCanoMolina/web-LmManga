import React, { useRef, useEffect, useState } from 'react';

// Color Palette
const vibrantColors = [
    '#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#FF8B94',
    '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3', '#A8D8EA',
    '#FFD93D', '#6BCF7F', '#FF6F91', '#C7CEEA', '#FFEAA7'
];

// Sound utility (simplified)
const playSound = (freq: number, type: 'sine' | 'square' = 'sine', duration: number = 0.1) => {
    // In a real app we would use a more robust sound manager context
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

const WheelGame: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [options, setOptions] = useState<string[]>(['Pizza', 'Sushi', 'Hamburguesa']);
    const [newOption, setNewOption] = useState('');
    const [isSpinning, setIsSpinning] = useState(false);
    const [winner, setWinner] = useState<string | null>(null);
    const currentRotationRef = useRef(0);

    // Initial Draw
    useEffect(() => {
        drawWheel();
    }, [options]);

    const drawWheel = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (options.length === 0) {
            // Draw Empty State
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 2;
            ctx.stroke();
            return;
        }

        const anglePerSegment = (2 * Math.PI) / options.length;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate((currentRotationRef.current * Math.PI) / 180);
        ctx.translate(-centerX, -centerY);

        options.forEach((option, index) => {
            const startAngle = index * anglePerSegment - Math.PI / 2;
            const endAngle = startAngle + anglePerSegment;
            const color = vibrantColors[index % vibrantColors.length];

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Text
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(startAngle + anglePerSegment / 2);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px Poppins';

            const displayText = option.length > 12 ? option.substring(0, 12) + '...' : option;
            ctx.fillText(displayText, radius * 0.65, 5);
            ctx.restore();
        });

        // Center Circle
        ctx.restore(); // Remove rotation for center circle
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
    };

    const handleSpin = () => {
        if (isSpinning || options.length < 2) return;

        setIsSpinning(true);
        setWinner(null);

        const minSpins = 5;
        const maxSpins = 8;
        const spins = minSpins + Math.random() * (maxSpins - minSpins);
        const totalRotation = spins * 360 + Math.random() * 360;

        const duration = 4000;
        const startTime = Date.now();
        const startRotation = currentRotationRef.current;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            currentRotationRef.current = (startRotation + totalRotation * easeProgress) % 360;
            drawWheel();

            if (progress < 1) {
                requestAnimationFrame(animate);
                // Simple click sound simulate
                if (Math.floor(elapsed / 100) % 2 === 0) playSound(200, 'sine', 0.05);
            } else {
                setIsSpinning(false);
                calculateWinner();
            }
        };
        animate();
    };

    const calculateWinner = () => {
        const normalizedRotation = (360 - (currentRotationRef.current % 360)) % 360;
        const anglePerOption = 360 / options.length;
        const winnerIndex = Math.floor(normalizedRotation / anglePerOption);
        const win = options[winnerIndex];
        setWinner(win);
        playSound(600, 'square', 0.3); // Win sound
    };

    const addOption = () => {
        if (newOption.trim() && options.length < 15) {
            setOptions([...options, newOption.trim()]);
            setNewOption('');
        }
    };

    const removeOption = (index: number) => {
        const newOpts = [...options];
        newOpts.splice(index, 1);
        setOptions(newOpts);
    };

    return (
        <section className="mode-section active">
            <div className="container">
                <header className="header">
                    <h1 className="title">🎯 Ruleta de Decisiones</h1>
                    <p className="subtitle">¿No sabes qué elegir? ¡Deja que la ruleta decida!</p>
                </header>

                <div className="content-grid">
                    {/* Options Panel */}
                    <div className="options-panel">
                        <div className="panel-header">
                            <h2>Tus Opciones</h2>
                            <span className="option-count">{options.length} opciones</span>
                        </div>

                        <div className="add-option-form">
                            <input
                                type="text"
                                className="option-input"
                                placeholder="Escribe una opción..."
                                value={newOption}
                                onChange={(e) => setNewOption(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && addOption()}
                                maxLength={50}
                            />
                            <button className="btn btn-add" onClick={addOption}>+</button>
                        </div>

                        <ul className="options-list">
                            {options.map((opt, idx) => (
                                <li key={idx} className="option-item">
                                    <span className="option-color" style={{ background: vibrantColors[idx % vibrantColors.length] }}></span>
                                    <span className="option-text">{opt}</span>
                                    <button className="btn-delete" onClick={() => removeOption(idx)}>
                                        x
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Wheel Panel */}
                    <div className="wheel-panel">
                        <div className="wheel-container">
                            <div className="wheel-pointer">▼</div>
                            <canvas ref={canvasRef} width={500} height={500} id="wheelCanvas"></canvas>
                            <button
                                className="spin-button"
                                onClick={handleSpin}
                                disabled={isSpinning || options.length < 2}
                            >
                                <span className="spin-text">GIRAR</span>
                                <span className="spin-icon">🎲</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Winner Modal */}
                {winner && (
                    <div className="modal active">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h2>🎉 ¡Tenemos Ganador! 🎉</h2>
                            </div>
                            <div className="modal-body">
                                <div className="winner-display">
                                    <div className="winner-text">{winner}</div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-primary" onClick={() => setWinner(null)}>¡Genial!</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};

export default WheelGame;
