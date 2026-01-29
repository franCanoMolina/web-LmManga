import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';

interface NavbarProps {
    toggleTheme: (theme: string) => void;
    currentTheme: string;
}

const Navbar: React.FC<NavbarProps> = ({ toggleTheme, currentTheme }) => {
    const [isThemeOpen, setIsThemeOpen] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const toggleSound = () => {
        const newState = !soundEnabled;
        setSoundEnabled(newState);
        localStorage.setItem('wheelSound', newState.toString());
    };

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const closeMenu = () => {
        setIsMenuOpen(false);
    };

    return (
        <nav className="navbar">
            <div className="navbar-content">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button className="hamburger-btn" onClick={toggleMenu} aria-label="Menu">
                        <span className="hamburger-line"></span>
                        <span className="hamburger-line"></span>
                        <span className="hamburger-line"></span>
                    </button>
                    <NavLink to="/" className="navbar-brand" onClick={closeMenu}>
                        <span className="brand-icon">🦆</span>
                        <span className="brand-text">Los Duck Games</span>
                    </NavLink>
                </div>

                <div className={`navbar-nav ${isMenuOpen ? 'active' : ''}`}>
                    <NavLink to="/wheel" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`} onClick={closeMenu}>
                        <span className="nav-icon">🎯</span>
                        <span className="nav-text">Ruleta</span>
                    </NavLink>
                    <NavLink to="/flappy" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`} onClick={closeMenu}>
                        <span className="nav-icon">🦆</span>
                        <span className="nav-text">Flappy</span>
                    </NavLink>
                    <NavLink to="/muack" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`} onClick={closeMenu}>
                        <span className="nav-icon">🐴</span>
                        <span className="nav-text">Muack</span>
                    </NavLink>
                    <NavLink to="/clicker" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`} onClick={closeMenu}>
                        <span className="nav-icon">💰</span>
                        <span className="nav-text">Golden Duck</span>
                    </NavLink>
                    <NavLink to="/weather" className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`} onClick={closeMenu}>
                        <span className="nav-icon">🌤️</span>
                        <span className="nav-text">Tiempo</span>
                    </NavLink>
                </div>

                <div className="navbar-controls">
                    <div className="theme-selector">
                        <button
                            className="control-btn"
                            onClick={() => setIsThemeOpen(!isThemeOpen)}
                            title="Cambiar tema"
                            style={{ fontSize: '1.5rem', background: 'var(--card-bg)', color: 'var(--text-primary)' }}
                        >
                            🎨
                        </button>
                        <div className={`theme-dropdown ${isThemeOpen ? 'active' : ''}`}>
                            <button className={`theme-option ${currentTheme === 'dark' ? 'active' : ''}`} onClick={() => { toggleTheme('dark'); setIsThemeOpen(false); }}>🌑 Simple</button>
                            <button className={`theme-option ${currentTheme === 'light' ? 'active' : ''}`} onClick={() => { toggleTheme('light'); setIsThemeOpen(false); }}>☀️ Claro</button>
                            <button className={`theme-option ${currentTheme === 'hellokitty' ? 'active' : ''}`} onClick={() => { toggleTheme('hellokitty'); setIsThemeOpen(false); }}>🎀 Hello Kitty</button>
                            <button className={`theme-option ${currentTheme === 'pooh' ? 'active' : ''}`} onClick={() => { toggleTheme('pooh'); setIsThemeOpen(false); }}>🍯 Winnie Pooh</button>
                            <button className={`theme-option ${currentTheme === 'doraemon' ? 'active' : ''}`} onClick={() => { toggleTheme('doraemon'); setIsThemeOpen(false); }}>🤖 Doraemon</button>
                            <button className={`theme-option ${currentTheme === 'vegetta777' ? 'active' : ''}`} onClick={() => { toggleTheme('vegetta777'); setIsThemeOpen(false); }}>💜 Vegetta777</button>
                        </div>
                    </div>

                    <button
                        className="control-btn"
                        onClick={toggleSound}
                        title={soundEnabled ? "Desactivar sonido" : "Activar sonido"}
                        style={{ fontSize: '1.5rem', opacity: soundEnabled ? 1 : 0.6, background: 'var(--card-bg)', color: 'var(--text-primary)' }}
                    >
                        {soundEnabled ? '🔊' : '🔇'}
                    </button>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
