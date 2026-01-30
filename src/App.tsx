import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import WheelGame from './components/WheelGame';
import FlappyGame from './components/FlappyGame';
import ClickerGame from './components/ClickerGame';
import RunnerGame from './components/RunnerGame';
import WeatherPanel from './components/WeatherPanel';
import Motivation from './components/Motivation';
import Login from './components/Login';
import './index.css';

const Home = () => {
  const { user } = useAuth();

  return (
    <section className="mode-section active">
      <div className="container">
        <header className="header" style={{ marginBottom: '2rem' }}>
          <h1 className="title">Bienvenido a los Duck Games</h1>
          <p className="subtitle">
            Sesión activa: <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{user?.username}</span>
          </p>
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
              <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>Goal Duck</h3>
              <p style={{ color: '#aaa' }}>Clicker Global</p>
            </NavLink>

            <NavLink to="/runner" className="menu-card" style={{ textDecoration: 'none', color: 'inherit', padding: '2rem', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="menu-icon" style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏃</div>
              <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>Duck Runner</h3>
              <p style={{ color: '#aaa' }}>Corre sin parar</p>
            </NavLink>
          </div>
        </main>
      </div>
    </section>
  );
};

function App() {
  const [theme, setTheme] = useState('dark');
  const { user, isLoading } = useAuth();

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

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--dark-bg)' }}>
        <div style={{ color: 'var(--text-primary)', fontSize: '1.5rem' }}>Cargando...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      {!user ? (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <Layout toggleTheme={handleThemeChange} currentTheme={theme}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/wheel" element={<WheelGame />} />
            <Route path="/flappy" element={<FlappyGame />} />
            <Route path="/muack" element={<Motivation />} />
            <Route path="/clicker" element={<ClickerGame />} />
            <Route path="/runner" element={<RunnerGame />} />
            <Route path="/weather" element={<WeatherPanel />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      )}
    </BrowserRouter>
  );
}

export default App;
