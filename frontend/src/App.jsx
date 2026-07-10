import React, { useState, useEffect } from 'react';
import EquipmentList from './components/EquipmentList';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState('');
  const [tempUser, setTempUser] = useState('');
  const [error, setError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Проверяем, есть ли сохранённый пользователь
  useEffect(() => {
    const user = localStorage.getItem('currentUser');
    if (user) {
      setCurrentUser(user);
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!tempUser.trim()) {
      setError('Введите ваше имя');
      return;
    }
    localStorage.setItem('currentUser', tempUser.trim());
    setCurrentUser(tempUser.trim());
    setIsLoggedIn(true);
    setError('');
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    setCurrentUser('');
    setIsLoggedIn(false);
  };

  if (!isLoggedIn) {
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
            Введите ваше имя для входа
          </p>
          
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Ваше имя..."
              value={tempUser}
              onChange={(e) => setTempUser(e.target.value)}
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
              <p style={{ color: '#f44336', fontSize: '14px', marginTop: '12px', marginBottom: '0' }}>
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
        </div>
      </div>
    );
  }

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
          👤 {currentUser}
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
      <EquipmentList currentUser={currentUser} />
    </div>
  );
}

export default App;