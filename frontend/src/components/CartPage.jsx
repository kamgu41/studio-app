import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { addDays, format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ru } from 'date-fns/locale';
const API_URL = 'https://studio-app-backend-bhcs.onrender.com';

function CartPage({ cart, setCart, onClose, onBookingComplete, currentUser }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedStart, setSelectedStart] = useState(null);
  const [selectedEnd, setSelectedEnd] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState('');
  
  const [bookedDates, setBookedDates] = useState([]);

  // Загрузка занятых дат (заглушка)
  const loadBookedDates = async () => {
    try {
      // Пока пусто, потом подключим реальные данные
      setBookedDates([]);
    } catch (err) {
      console.error('❌ Ошибка загрузки бронирований:', err);
      setBookedDates([]);
    }
  };

  useEffect(() => {
    loadBookedDates();
  }, [cart]);

  // Проверка занятости даты
  const isDateBusy = (date) => {
    for (let b of bookedDates) {
      const start = new Date(b.start);
      const end = new Date(b.end);
      if (date >= start && date <= end) {
        return b.type;
      }
    }
    return null;
  };

  // Выбор даты
  const handleDateClick = (date) => {
    if (isDateBusy(date)) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) return;

    if (!selecting) {
      setSelectedStart(date);
      setSelectedEnd(null);
      setSelecting(true);
    } else {
      if (date >= selectedStart) {
        setSelectedEnd(date);
      } else {
        setSelectedStart(date);
        setSelectedEnd(null);
      }
      setSelecting(false);
    }
  };

  const isDateSelected = (date) => {
    if (!selectedStart) return false;
    if (!selectedEnd) return isSameDay(date, selectedStart);
    return date >= selectedStart && date <= selectedEnd;
  };

  // Навигация по месяцам
  const goToPrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Управление корзиной
  const removeFromCart = (itemId) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  const clearCart = () => {
    if (window.confirm('Очистить корзину?')) {
      setCart([]);
    }
  };

  // Основная функция бронирования
  const confirmBooking = async () => {
    if (!selectedStart || !selectedEnd) {
      alert('Выберите даты бронирования');
      return;
    }

    // Проверяем занятость дат
    let isBusy = false;
    let currentDate = new Date(selectedStart);
    const endDate = new Date(selectedEnd);
    
    while (currentDate <= endDate) {
      const status = isDateBusy(currentDate);
      if (status === 'rented') {
        isBusy = true;
        alert(`❌ Дата ${format(currentDate, 'dd.MM.yyyy')} уже занята!`);
        break;
      }
      if (status === 'repair') {
        isBusy = true;
        alert(`🔧 Дата ${format(currentDate, 'dd.MM.yyyy')} - оборудование в ремонте!`);
        break;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (isBusy) return;

    setLoading(true);

    try {
      const ids = cart.map(item => item.id);
      await axios.post(`${API_URL}/api/equipment/bulk-book`, {
        ids: ids,
        rentedBy: currentUser,
        rentedUntil: selectedEnd.toISOString().split('T')[0],
        comment: comment || null
      });

      onBookingComplete();
      setCart([]);
      setSelectedStart(null);
      setSelectedEnd(null);
      setSelecting(false);
      setComment('');
      
      alert(`✅ Бронирование оформлено!\n${cart.length} позиций\nс ${format(selectedStart, 'dd.MM.yyyy')} по ${format(selectedEnd, 'dd.MM.yyyy')}\nКто взял: ${currentUser}`);
    } catch (err) {
      alert('Ошибка при бронировании: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Генерация календаря
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const firstDayOffset = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;

  if (cart.length === 0) {
    return (
      <div style={{
        maxWidth: '600px',
        margin: '40px auto',
        padding: '40px',
        backgroundColor: '#111',
        borderRadius: '12px',
        border: '1px solid #2a2a2a',
        textAlign: 'center'
      }}>
        <h2 style={{ color: '#666' }}>🛒 Корзина пуста</h2>
        <p style={{ color: '#555' }}>Добавьте оборудование из списка</p>
        <button onClick={onClose} style={{
          marginTop: '20px',
          padding: '8px 24px',
          backgroundColor: '#333',
          border: 'none',
          borderRadius: '4px',
          color: '#aaa',
          cursor: 'pointer'
        }}>
          ← Вернуться к списку
        </button>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '900px',
      margin: '0 auto',
      padding: '20px'
    }}>
      {/* Шапка корзины */}
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
            🛒 Корзина <span style={{ color: '#666', fontWeight: '300' }}>({cart.length})</span>
          </h2>
          <p style={{ margin: '4px 0 0', color: '#555', fontSize: '13px' }}>
            {cart.length} позиций готовы к бронированию
          </p>
          {currentUser && (
            <p style={{ margin: '4px 0 0', color: '#4caf50', fontSize: '13px' }}>
              👤 Бронирует: {currentUser}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={clearCart} style={{
            padding: '6px 16px',
            backgroundColor: '#333',
            border: 'none',
            borderRadius: '4px',
            color: '#888',
            fontSize: '13px',
            cursor: 'pointer'
          }}>
            Очистить
          </button>
          <button onClick={onClose} style={{
            padding: '6px 16px',
            backgroundColor: '#333',
            border: 'none',
            borderRadius: '4px',
            color: '#aaa',
            fontSize: '13px',
            cursor: 'pointer'
          }}>
            ✕ Закрыть
          </button>
        </div>
      </div>

      {/* Список в корзине */}
      <div style={{ marginBottom: '24px' }}>
        {cart.map((item) => (
          <div key={item.id} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            backgroundColor: '#111',
            borderRadius: '6px',
            marginBottom: '4px',
            borderLeft: '3px solid #4caf50'
          }}>
            <span style={{ color: '#ddd' }}>{item.name}</span>
            <button onClick={() => removeFromCart(item.id)} style={{
              background: 'none',
              border: 'none',
              color: '#666',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '4px 8px'
            }}
            onMouseEnter={(e) => e.target.style.color = '#f44336'}
            onMouseLeave={(e) => e.target.style.color = '#666'}>
              ✕ Удалить
            </button>
          </div>
        ))}
      </div>

      {/* Календарь */}
      <div style={{
        backgroundColor: '#111',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px',
        border: '1px solid #2a2a2a'
      }}>
        <h3 style={{ color: '#fff', marginTop: 0, fontSize: '16px' }}>
          📅 Выберите даты аренды
        </h3>
        <p style={{ color: '#666', fontSize: '13px', marginBottom: '16px' }}>
          🟢 Выбранный период
        </p>
        
        {/* Навигация */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <button onClick={goToPrevMonth} style={{
            background: 'none',
            border: '1px solid #333',
            borderRadius: '4px',
            color: '#888',
            padding: '4px 12px',
            cursor: 'pointer'
          }}>
            ←
          </button>
          <span style={{ color: '#e0e0e0', fontWeight: '500' }}>
            {format(currentMonth, 'LLLL yyyy', { locale: ru })}
          </span>
          <button onClick={goToNextMonth} style={{
            background: 'none',
            border: '1px solid #333',
            borderRadius: '4px',
            color: '#888',
            padding: '4px 12px',
            cursor: 'pointer'
          }}>
            →
          </button>
        </div>

        {/* Сетка календаря */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '4px'
        }}>
          {weekDays.map((day) => (
            <div key={day} style={{
              textAlign: 'center',
              color: '#666',
              fontSize: '12px',
              padding: '8px 0',
              fontWeight: '500'
            }}>
              {day}
            </div>
          ))}

          {Array.from({ length: firstDayOffset }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {daysInMonth.map((date) => {
            const status = isDateBusy(date);
            const isSelected = isDateSelected(date);
            const isToday = isSameDay(date, new Date());
            const isPast = date < new Date() && !isToday;

            let backgroundColor = 'transparent';
            let textColor = '#e0e0e0';
            let cursor = 'pointer';
            let border = 'none';

            if (status === 'rented') {
              backgroundColor = '#b91c1c';
              textColor = '#fff';
              cursor = 'default';
            } else if (status === 'repair') {
              backgroundColor = '#b45309';
              textColor = '#fff';
              cursor = 'default';
            } else if (isSelected) {
              backgroundColor = '#4caf50';
              textColor = '#0b0b0b';
            } else if (isPast) {
              textColor = '#444';
              cursor = 'default';
            }

            if (isToday && !status && !isSelected) {
              border = '2px solid #4caf50';
            }

            return (
              <div
                key={date.toISOString()}
                onClick={() => handleDateClick(date)}
                style={{
                  aspectRatio: '1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor,
                  color: textColor,
                  borderRadius: '4px',
                  cursor,
                  border,
                  fontSize: '14px',
                  fontWeight: isSelected ? '600' : '400',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!status && !isPast && !isSelected) {
                    e.target.style.backgroundColor = '#2a2a2a';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!status && !isPast && !isSelected) {
                    e.target.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {date.getDate()}
              </div>
            );
          })}
        </div>

        {/* Инструкция */}
        <div style={{
          marginTop: '16px',
          color: '#555',
          fontSize: '12px',
          textAlign: 'center'
        }}>
          {selectedStart && !selectedEnd 
            ? `Выбрано начало: ${format(selectedStart, 'dd.MM.yyyy')}. Кликните на дату окончания.`
            : selectedStart && selectedEnd 
            ? `Выбран период: ${format(selectedStart, 'dd.MM.yyyy')} — ${format(selectedEnd, 'dd.MM.yyyy')}`
            : 'Кликните на дату начала, затем на дату окончания'}
        </div>
      </div>

      {/* Поле для комментария */}
      <div style={{
        marginBottom: '16px',
        padding: '16px',
        backgroundColor: '#0b0b0b',
        borderRadius: '6px',
        border: '1px solid #2a2a2a'
      }}>
        <label style={{ color: '#aaa', fontSize: '13px', display: 'block', marginBottom: '4px' }}>
          📝 Комментарий к бронированию (необязательно)
        </label>
        <input
          type="text"
          placeholder="Например: верну в 14:00, забираю на выезд..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            backgroundColor: '#111',
            border: '1px solid #333',
            borderRadius: '4px',
            color: '#e0e0e0',
            fontSize: '14px',
            outline: 'none'
          }}
        />
      </div>

      {/* Кнопка оформления */}
      <button
        onClick={confirmBooking}
        disabled={loading || !selectedStart || !selectedEnd}
        style={{
          width: '100%',
          padding: '14px',
          backgroundColor: loading || !selectedStart || !selectedEnd ? '#333' : '#4caf50',
          border: 'none',
          borderRadius: '6px',
          color: loading || !selectedStart || !selectedEnd ? '#666' : '#0b0b0b',
          fontSize: '16px',
          fontWeight: '600',
          cursor: loading || !selectedStart || !selectedEnd ? 'default' : 'pointer',
          transition: 'background-color 0.2s'
        }}
      >
        {loading ? '⏳ Бронирование...' : '✅ Забронировать всё'}
      </button>
    </div>
  );
}

export default CartPage;