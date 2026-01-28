import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Layout from './components/Layout';
import WheelGame from './components/WheelGame';
import FlappyGame from './components/FlappyGame';
import ClickerGame from './components/ClickerGame';
import WeatherPanel from './components/WeatherPanel';
import Motivation from './components/Motivation';
import './index.css';

const Home = () => {
  return (
    <section className="mode-section active">
      <div className="container">
        <header className="header" style={{ marginBottom: '2rem' }}>
          <h1 className="title">Bienvenido a los Duck Games</h1>
          <p className="subtitle">Selecciona un juego para comenzar</p>
        </header>

        <main className="main-content">
          <div className="menu-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '2rem',
            marginTop: '2rem'
          }}>
            <NavLink to="/wheel" className="menu-card" style={{ textDecoration: 'none', color: 'inherit', padding: '2rem', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="menu-icon" style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
              <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>Ruleta</h3>
              <p style={{ color: '#aaa' }}>Decide tu suerte</p>
            </NavLink>

            <NavLink to="/flappy" className="menu-card" style={{ textDecoration: 'none', color: 'inherit', padding: '2rem', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="menu-icon" style={{ fontSize: '3rem', marginBottom: '1rem' }}>🦆</div>
              <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>Flappy Duck</h3>
              <p style={{ color: '#aaa' }}>Vuela alto</p>
            </NavLink>

            <NavLink to="/muack" className="menu-card" style={{ textDecoration: 'none', color: 'inherit', padding: '2rem', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="menu-icon" style={{ fontSize: '3rem', marginBottom: '1rem' }}>🐴</div>
              <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>Muack</h3>
              <p style={{ color: '#aaa' }}>Motivación diaria</p>
            </NavLink>

            <NavLink to="/weather" className="menu-card" style={{ textDecoration: 'none', color: 'inherit', padding: '2rem', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="menu-icon" style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌤️</div>
              <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>El Tiempo</h3>
              <p style={{ color: '#aaa' }}>Motril en vivo</p>
            </NavLink>

            <NavLink to="/clicker" className="menu-card" style={{ textDecoration: 'none', color: 'inherit', padding: '2rem', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="menu-icon" style={{ fontSize: '3rem', marginBottom: '1rem' }}>💰</div>
              <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>Golden Duck</h3>
              <p style={{ color: '#aaa' }}>Clicker Global</p>
            </NavLink>
          </div>
        </main>
      </div>
    </section>
  );
};

function App() {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('wheelTheme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('wheelTheme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return (
    <BrowserRouter>
      <Layout toggleTheme={handleThemeChange} currentTheme={theme}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/wheel" element={<WheelGame />} />
          <Route path="/flappy" element={<FlappyGame />} />
          <Route path="/muack" element={<Motivation />} />
          <Route path="/clicker" element={<ClickerGame />} />
          <Route path="/weather" element={<WeatherPanel />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
