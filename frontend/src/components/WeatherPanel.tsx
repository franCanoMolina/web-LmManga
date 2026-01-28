import React, { useState, useEffect } from 'react';

const WeatherPanel: React.FC = () => {
    const [weather, setWeather] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        // Clock timer
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);

        // Fetch Weather
        fetchWeather();

        return () => clearInterval(timer);
    }, []);

    const fetchWeather = async () => {
        try {
            // Using Motril coordinates
            const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=36.74&longitude=-3.52&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Europe%2FMadrid');
            const data = await response.json();
            setWeather(data);
        } catch (error) {
            console.error("Error fetching weather:", error);
        } finally {
            setLoading(false);
        }
    };

    const getWeatherEffect = (code: number) => {
        // WMO Weather interpretation codes (http://www.wmo.int/pages/prog/www/IMOP/publications/CIMO-Guide/Updates/ON_CODES/WMO4888_2011_en.pdf)
        if (code === 0) return 'sunny';
        if (code >= 1 && code <= 3) return 'cloudy';
        if (code >= 45 && code <= 48) return 'fog';
        if (code >= 51 && code <= 67) return 'rainy';
        if (code >= 71 && code <= 77) return 'snowy';
        if (code >= 80 && code <= 82) return 'rainy';
        if (code >= 95) return 'thunder';
        // Check for night time logic if needed, but simplistic approach first
        const hours = new Date().getHours();
        if (hours > 20 || hours < 7) return 'night';

        return 'sunny'; // Default
    };

    const getWeatherLabel = (code: number) => {
        if (code === 0) return 'Cielo Despejado';
        if (code >= 1 && code <= 3) return 'Parcialmente Nublado';
        if (code >= 45 && code <= 48) return 'Niebla';
        if (code >= 51 && code <= 67) return 'Llaura (Lluvia)';
        if (code >= 71 && code <= 77) return 'Nieve';
        if (code >= 80 && code <= 82) return 'Lluvia Fuerte';
        if (code >= 95) return 'Tormenta';
        return 'Normal';
    };

    if (loading) return <div style={{ color: 'white', textAlign: 'center', paddingTop: '100px' }}>Cargando el tiempo de Motril...</div>;

    const current = weather?.current;
    const effectClass = current ? `effect-${getWeatherEffect(current.weather_code)}` : '';
    const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <section className="mode-section active">
            <div className="weather-container">
                <div className="weather-card-custom">
                    <div className="weather-header">
                        <h2 className="city-name-custom">Motril</h2>
                        <div className="time-display-custom">{formattedTime}</div>
                    </div>

                    <div className="avatar-section">
                        <div className={`weather-avatar-wrapper ${effectClass}`}>
                            <img src="/maria.png" alt="Maria Weather Avatar" className="maria-avatar" />
                            <div className="weather-overlay"></div>
                        </div>
                    </div>

                    <div className="temp-section">
                        <span className="temp-value-custom">{current?.temperature_2m}<span className="temp-unit-custom">°C</span></span>
                        <div className="weather-desc-custom">{current ? getWeatherLabel(current.weather_code) : '--'}</div>
                    </div>

                    <div className="weather-divider"></div>

                    <div className="weather-details-custom">
                        <div className="detail-box">
                            <span className="detail-icon-custom">💧</span>
                            <span className="detail-value">{current?.relative_humidity_2m}%</span>
                            <span className="detail-label">HUMEDAD</span>
                        </div>
                        <div className="detail-box">
                            <span className="detail-icon-custom">💨</span>
                            <span className="detail-value">{current?.wind_speed_10m} km/h</span>
                            <span className="detail-label">VIENTO</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default WeatherPanel;
