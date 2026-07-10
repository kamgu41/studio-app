import React, { useState, useEffect } from 'react';
import EquipmentList from './components/EquipmentList';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState('');
  const [showUserSelect, setShowUserSelect] = useState(false);
  const [tempUser, setTempUser] = useState('');

  // Проверяем сессию при загрузке
  useEffect(() => {
    const auth = localStorage.getItem('studioAuth');
    const user = localStorage.getItem('currentUser');
    if (auth === 'true' && user) {
      setIsAuthenticated(true);
      setCurrentUser(user);
    }
  }, []);

  // Вход по паролю
  const handleLogin = (e) => {
    e.preventDefault();
    const STUDIO_PASSWORD = 'kamfilm2026';
    
    if (password === STUDIO_PASSWORD) {
      localStorage.setItem('studioAuth', 'true');
      setShowUserSelect(true); // ← показываем выбор пользователя
      setError('');
      setPassword('');
    } else {
      setError('Неверный пароль');
      setPassword('');
    }
  };

  // Выбор пользователя
  const handleUserSelect = (e) => {
    e.preventDefault();
    if (!tempUser.trim()) {
      setError('Введите имя пользователя');
      return;
    }
    localStorage.setItem('currentUser', tempUser.trim());
    setCurrentUser(tempUser.trim());
    setIsAuthenticated(true);
    setShowUserSelect(false);
    setError('');
  };

  // Выход
  const handleLogout = () => {
    localStorage.removeItem('studioAuth');
    localStorage.removeItem('currentUser');
    setIsAuthenticated(false);
    setCurrentUser('');
  };

  // ===== СТРАНИЦА ВХОДА (ПАРОЛЬ) =====
  if (!isAuthenticated && !showUserSelect) {
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
              placeholder="Пароль..."
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
          
          <p style={{ color: '#444', fontSize: '12px', marginTop: '20px', textAlign: 'center' }}>
            Пароль: <span style={{ color: '#666', fontWeight: '500' }}>kamfilm2026</span>
          </p>
        </div>
      </div>
    );
  }

  // ===== СТРАНИЦА ВЫБОРА ПОЛЬЗОВАТЕЛЯ =====
  if (showUserSelect) {
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
          <h1 style={{ color: '#fff', marginTop: 0, fontSize: '24px', fontWeight: '300', letterSpacing: '2px' }}>
            👤 Кто вы?
          </h1>
          <p style={{ color: '#888', marginBottom: '24px', fontSize: '14px' }}>
            Введите ваше имя или выберите из списка
          </p>
          
          <form onSubmit={handleUserSelect}>
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
                boxSizing: 'border-box',
                marginBottom: '12px'
              }}
              autoFocus
            />
            
            {error && (
              <p style={{ color: '#f44336', fontSize: '14px', marginBottom: '12px' }}>
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
                cursor: 'pointer'
              }}
            >
              Продолжить как {tempUser || '...'}
            </button>
          </form>
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