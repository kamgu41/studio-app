import React, { useEffect, useState } from 'react';
import axios from 'axios';

function MyBookings({ currentUser, onClose, onReturnComplete }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [returningIds, setReturningIds] = useState([]);
  const [isReturningAll, setIsReturningAll] = useState(false);

  // Загружаем бронирования текущего пользователя
  const loadMyBookings = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/my-bookings?user=${encodeURIComponent(currentUser)}`);
      setBookings(response.data);
      setError(null);
    } catch (err) {
      console.error('❌ Ошибка загрузки:', err);
      setError('Не удалось загрузить ваши бронирования');
    } finally {
      setLoading(false);
    }
  };

  // Возврат ОДНОГО предмета
  const returnItem = async (id) => {
    if (!window.confirm('Вернуть это оборудование?')) return;
    
    setReturningIds(prev => [...prev, id]);
    
    try {
      await axios.patch(`/api/equipment/${id}/status`, { status: 'available' });
      
      // Обновляем локальный список
      setBookings(prev => prev.filter(item => item.id !== id));
      
      // Уведомляем родителя
      onReturnComplete(id);
      
    } catch (err) {
      alert('Ошибка при возврате: ' + err.message);
    } finally {
      setReturningIds(prev => prev.filter(pid => pid !== id));
    }
  };

  // Возврат ВСЕГО (массовый)
  // Возврат ВСЕГО (массовый)
const returnAll = async () => {
  if (bookings.length === 0) return;
  if (!window.confirm(`Вернуть ВСЁ оборудование (${bookings.length} позиций)?`)) return;

  setIsReturningAll(true);

  try {
    const ids = bookings.map(item => item.id);
    await axios.post('/api/equipment/bulk-return', { ids });
    
    // Очищаем список
    setBookings([]);
    
    // Уведомляем родителя (передаём null, чтобы обновить всё)
    onReturnComplete(null);
    
  } catch (err) {
    alert('Ошибка при возврате: ' + (err.response?.data?.error || err.message));
  } finally {
    setIsReturningAll(false);
  }
};

  useEffect(() => {
    loadMyBookings();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>
        ⏳ Загрузка ваших бронирований...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: '#f44336', textAlign: 'center', padding: '40px' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '900px',
      margin: '0 auto',
      padding: '20px'
    }}>
      {/* Шапка */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        borderBottom: '1px solid #2a2a2a',
        paddingBottom: '16px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h2 style={{ margin: 0, color: '#fff' }}>
            📋 Мои бронирования
          </h2>
          <p style={{ margin: '4px 0 0', color: '#555', fontSize: '13px' }}>
            {currentUser ? `👤 ${currentUser}` : ''}
            {bookings.length > 0 && (
              <span style={{ marginLeft: '12px', color: '#888' }}>
                ({bookings.length} позиций)
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {bookings.length > 0 && (
            <button
              onClick={returnAll}
              disabled={isReturningAll}
              style={{
                padding: '6px 16px',
                backgroundColor: isReturningAll ? '#555' : '#b91c1c',
                border: 'none',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '13px',
                cursor: isReturningAll ? 'default' : 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!isReturningAll) e.target.style.backgroundColor = '#d32f2f';
              }}
              onMouseLeave={(e) => {
                if (!isReturningAll) e.target.style.backgroundColor = '#b91c1c';
              }}
            >
              {isReturningAll ? '⏳ ...' : '🔄 Вернуть всё'}
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              backgroundColor: '#333',
              border: 'none',
              borderRadius: '4px',
              color: '#aaa',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            ✕ Закрыть
          </button>
        </div>
      </div>

      {/* Список */}
      {bookings.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#555',
          fontSize: '16px'
        }}>
          🎉 У вас пока нет активных бронирований
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {bookings.map((item) => {
            const isReturning = returningIds.includes(item.id);
            return (
              <div key={item.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: '#111',
                borderRadius: '6px',
                borderLeft: '3px solid #4caf50',
                flexWrap: 'wrap',
                gap: '8px',
                opacity: isReturning ? 0.5 : 1
              }}>
                <div>
                  <span style={{ color: '#ddd', fontSize: '14px' }}>
                    {item.name}
                  </span>
                  {item.rented_until && (
                    <span style={{ color: '#666', fontSize: '12px', marginLeft: '12px' }}>
                      ⏳ до {new Date(item.rented_until).toLocaleDateString()}
                    </span>
                  )}
                  {item.comment && (
                    <span style={{ color: '#b45309', fontSize: '12px', marginLeft: '12px', fontStyle: 'italic' }}>
                      💬 {item.comment}
                    </span>
                  )}
                </div>
                
                <button
                  onClick={() => returnItem(item.id)}
                  disabled={isReturning}
                  style={{
                    padding: '4px 16px',
                    backgroundColor: isReturning ? '#555' : '#b91c1c',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#fff',
                    fontSize: '12px',
                    cursor: isReturning ? 'default' : 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!isReturning) e.target.style.backgroundColor = '#d32f2f';
                  }}
                  onMouseLeave={(e) => {
                    if (!isReturning) e.target.style.backgroundColor = '#b91c1c';
                  }}
                >
                  {isReturning ? '⏳ ...' : '🔄 Вернуть'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MyBookings;