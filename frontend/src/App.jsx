import React, { useState, useEffect } from 'react';
import EquipmentList from './components/EquipmentList';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState('');

  // Проверяем, есть ли уже сессия
  useEffect(() => {
    const auth = localStorage.getItem('studioAuth');
    const user = localStorage.getItem('currentUser');
    if (auth === 'true') {
      setIsAuthenticated(true);
      if (user) setCurrentUser(user);
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    const STUDIO_PASSWORD = 'kamfilm2026';
    
    if (password === STUDIO_PASSWORD) {
      localStorage.setItem('studioAuth', 'true');
      localStorage.setItem('currentUser', 'Студия');
      setCurrentUser('Студия');
      setIsAuthenticated(true);
      setError('');
      setPassword('');
    } else {
      setError('Неверный пароль');
      setPassword('');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('studioAuth');
    localStorage.removeItem('currentUser');
    setIsAuthenticated(false);
    setCurrentUser('');
  };

  // ===== СТРАНИЦА ВХОДА =====
  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0b0b0b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'sans-serif',
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: '#1a1a1a',
          padding: '40px',
          borderRadius: '12px',
          border: '1px solid #2a2a2a',
          maxWidth: '400px',
          width: '100%'
        }}>
          <h1 style={{ color: '#fff', marginTop: 0, fontSize: '28px', fontWeight: '300', letterSpacing: '2px' }}>
            🎬 КАМФИЛЬМ
          </h1>
          <p style={{ color: '#888', marginBottom: '24px', fontSize: '14px' }}>
            Введите пароль для доступа к системе учёта
          </p>
          
          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="Введите пароль..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: '#0b0b0b',
                border: '1px solid #333',
                borderRadius: '6px',
                color: '#e0e0e0',
                fontSize: '16px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              autoFocus
            />
            
            {error && (
              <p style={{ 
                color: '#f44336', 
                fontSize: '14px', 
                marginTop: '12px', 
                marginBottom: '0' 
              }}>
                ❌ {error}
              </p>
            )}
            
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#4caf50',
                border: 'none',
                borderRadius: '6px',
                color: '#0b0b0b',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                marginTop: '20px'
              }}
            >
              Войти
            </button>
          </form>
          
          <p style={{ 
            color: '#444', 
            fontSize: '12px', 
            marginTop: '20px', 
            textAlign: 'center' 
          }}>
            Пароль: <span style={{ color: '#666', fontWeight: '500' }}>kamfilm2026</span>
          </p>
        </div>
      </div>
    );
  }

  // ===== ОСНОВНОЕ ПРИЛОЖЕНИЕ =====
  return (
    <div className="App">
      <div style={{
        position: 'fixed',
        top: '12px',
        right: '20px',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        backgroundColor: '#1a1a1a',
        padding: '6px 16px 6px 20px',
        borderRadius: '20px',
        border: '1px solid #2a2a2a'
      }}>
        <span style={{ color: '#888', fontSize: '12px' }}>
          👤 {currentUser || 'Студия'}
        </span>
        <button
          onClick={handleLogout}
          style={{
            background: 'none',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            fontSize: '12px',
            padding: '4px 8px'
          }}
        >
          ✕ Выйти
        </button>
      </div>
      <EquipmentList currentUser={currentUser || 'Студия'} />
    </div>
  );
}

export default App;