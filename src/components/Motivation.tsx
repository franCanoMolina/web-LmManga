import React from 'react';

const Motivation: React.FC = () => {
    return (
        <section className="mode-section active">
            <div className="motivacion-container" style={{ textAlign: 'center', padding: '4rem', color: '#fff' }}>
                <div className="motivacion-content">
                    <img src="/grasa.png" alt="La Grasa" className="motivacion-image" style={{ width: '200px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} />
                    <h1 className="motivacion-text" style={{ fontSize: '3rem', margin: '2rem 0', background: 'linear-gradient(135deg, #FF6B6B 0%, #FFE66D 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 'bold' }}>
                        ERES LA GRASA MI LOK@
                    </h1>
                    <div className="motivacion-emoji" style={{ fontSize: '4rem' }}>🐎🐴</div>
                </div>
            </div>
        </section>
    );
};

export default Motivation;
