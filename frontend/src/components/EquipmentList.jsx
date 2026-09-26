import React, { useEffect, useRef, useState } from 'react';
import axios from '../api';
import CartPage from './CartPage';
import MyBookings from './MyBookings';
import EditorPanel from './EditorPanel';
import { displayDate, mutationError } from './bookingUi';


const API_URL = '';


function EquipmentList({ currentUser }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [showMyBookings, setShowMyBookings] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  const [mainCategories, setMainCategories] = useState([]);
  const [openCategories, setOpenCategories] = useState({});

  const [showRepairModal, setShowRepairModal] = useState(false);
  const [repairItemId, setRepairItemId] = useState(null);
  const [repairComment, setRepairComment] = useState('');

  const [showRepairDetails, setShowRepairDetails] = useState(false);
  const [repairDetailsItem, setRepairDetailsItem] = useState(null);

  const [hasLoaded, setHasLoaded] = useState(false);
  const [repairBusy, setRepairBusy] = useState(false);
  const repairLock = useRef(false);


  // ===== ЗАГРУЗКА ДАННЫХ =====
  const loadEquipment = async () => {
    try {
      setLoading(true);
      console.log('🟢 Загружаем данные...');
      
      const response = await axios.get(`${API_URL}/api/full-hierarchy`);
      
      console.log('✅ Данные загружены:', response.data.length, 'категорий');
      setMainCategories(response.data);
      setHasLoaded(true);
      setError(null);
    } catch (err) {
      console.error('❌ Ошибка загрузки:', err);
      setError('Не удалось загрузить данные. Проверьте подключение к серверу.');
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (id) => {
    setOpenCategories(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // ===== РЕМОНТ ЧЕРЕЗ API V2 =====

const openRepairModal = (id) => {
  if (repairLock.current) return;

  setRepairItemId(id);
  setRepairComment('');
  setShowRepairModal(true);
};

const performRepair = async (id, action, comment = '') => {
  if (repairLock.current) return;

  if (typeof currentUser !== 'string' || !currentUser.trim()) {
    alert('Сначала выберите пользователя');
    return;
  }

  repairLock.current = true;
  setRepairBusy(true);

  try {
    await axios.post(
      `${API_URL}/api/booking-v2/equipment/${id}/repair`,
      {
        action,
        comment: comment.trim() || null
      }
    );

    if (action === 'start') {
      setCart(previous => previous.filter(item => item.id !== id));
      setShowRepairModal(false);
      setRepairItemId(null);
      setRepairComment('');
    }

    await loadEquipment();
  } catch (err) {
    alert(mutationError(err));

    // Даже при потерянном ответе операция могла сохраниться.
    // Пытаемся получить актуальное состояние оборудования.
    await loadEquipment();
  } finally {
    repairLock.current = false;
    setRepairBusy(false);
  }
};

const confirmRepair = async () => {
  if (!repairItemId) return;

  await performRepair(repairItemId, 'start', repairComment);
};

const finishRepair = async (id) => {
  if (repairLock.current) return;

  if (!window.confirm('Ремонт завершён, предмет снова исправен?')) {
    return;
  }

  await performRepair(id, 'finish');
};


  const openRepairDetails = (item) => {
    setRepairDetailsItem(item);
    setShowRepairDetails(true);
  };

  // ===== КОРЗИНА =====
  const addToCart = (item) => {
  const alreadyInCart = cart.some(entry => entry.id === item.id);

  if (alreadyInCart) {
    setCart(previous => previous.filter(entry => entry.id !== item.id));
    return;
  }

  if (!['available', 'rented'].includes(item.status)) {
    alert('Предмет в ремонте или имеет неподдерживаемый статус');
    return;
  }

  setCart(previous =>
    previous.some(entry => entry.id === item.id)
      ? previous
      : [...previous, item]
  );
};


  useEffect(() => {
    loadEquipment();
  }, []);

  const totalItems = mainCategories.reduce((acc, main) => {
    const subs = main.subCategories || [];
    return acc + subs.reduce((subAcc, sub) => subAcc + (sub.items || []).length, 0);
  }, 0);

  const isMobile = window.innerWidth < 600;

  if (loading && !hasLoaded) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>⏳ Загрузка...</div>;
  }

  if (error && !hasLoaded) {
    return <div style={{ color: '#f44336', textAlign: 'center', padding: '40px' }}>{error}</div>;
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0b0b0b',
      color: '#e0e0e0',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: isMobile ? '10px' : '20px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: isMobile ? '10px' : '20px 20px 40px'
      }}>
        {/* ===== ШАПКА (АДАПТИВНАЯ) ===== */}
        <header style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #2a2a2a',
          paddingBottom: '12px',
          marginBottom: '16px',
          gap: '8px'
        }}>
          <div>
            <h1 style={{
              fontSize: isMobile ? '18px' : '24px',
              fontWeight: '300',
              letterSpacing: '2px',
              margin: 0,
              color: '#ffffff',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.color = '#888'}
            onMouseLeave={(e) => e.target.style.color = '#ffffff'}
            onClick={() => {
              const password = prompt('Введите пароль для доступа к редактору:');
              if (password === '0000') {
                setShowEditor(true);
              } else if (password !== null) {
                alert('Неверный пароль');
              }
            }}>
              ОБОРУДОВАНИЕ <span style={{ color: '#666', fontWeight: '200' }}>| КАМФИЛЬМ</span>
            </h1>
            <p style={{
              fontSize: '12px',
              color: '#555',
              margin: '2px 0 0 0',
              letterSpacing: '0.5px'
            }}>
              {totalItems} позиций
            </p>
          </div>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: isMobile ? '6px' : '16px',
            flexWrap: 'wrap'
          }}>
            <div style={{
              display: 'flex',
              gap: '6px',
              fontSize: isMobile ? '8px' : '12px',
              color: '#555'
            }}>
              <span>● ДОСТУПНО</span>
              <span style={{ color: '#b45309' }}>● РЕМОНТ</span>
              <span style={{ color: '#b91c1c' }}>● ЗАНЯТО</span>
            </div>

            <button
              onClick={() => setShowMyBookings(true)}
              style={{
                padding: isMobile ? '4px 10px' : '8px 16px',
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '20px',
                color: '#e0e0e0',
                fontSize: isMobile ? '11px' : '14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap'
              }}
            >
              📋 Мои брони
            </button>

            <button
              onClick={() => setShowCart(true)}
              style={{
                position: 'relative',
                padding: isMobile ? '4px 10px' : '8px 16px',
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '20px',
                color: '#e0e0e0',
                fontSize: isMobile ? '11px' : '14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap'
              }}
            >
              🛒 Корзина
              {cart.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  backgroundColor: '#4caf50',
                  color: '#0b0b0b',
                  fontSize: '10px',
                  fontWeight: '600',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </header>
        <div style={{
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap',
  marginBottom: '12px'
}}>
  <button
    type="button"
    onClick={loadEquipment}
    disabled={loading || repairBusy}
    style={{
      padding: '6px 12px',
      backgroundColor: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '6px',
      color: '#aaa',
      cursor: loading ? 'default' : 'pointer'
    }}
  >
    {loading ? 'Обновление…' : 'Обновить список'}
  </button>

  <span style={{ color: '#888', fontSize: '12px' }}>
    Статус показывает физическое состояние.
    Свободные даты проверяются в корзине.
  </span>
</div>

{error && (
  <p role="alert" style={{ color: '#ffb4b4' }}>
    {error} Показаны ранее загруженные данные.
  </p>
)}



        {/* ===== ВКЛАДКИ (АДАПТИВНЫЕ) ===== */}
        <div style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '16px',
          borderBottom: '1px solid #2a2a2a',
          paddingBottom: '4px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none'
        }}>
          <button 
            onClick={() => setActiveTab('all')}
            style={{
              padding: isMobile ? '6px 12px' : '8px 20px',
              backgroundColor: activeTab === 'all' ? '#2a2a2a' : 'transparent',
              border: 'none',
              borderRadius: '4px 4px 0 0',
              color: activeTab === 'all' ? '#fff' : '#666',
              fontSize: isMobile ? '11px' : '13px',
              fontWeight: activeTab === 'all' ? '500' : '400',
              cursor: 'pointer',
              borderBottom: activeTab === 'all' ? '2px solid #4caf50' : '2px solid transparent',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            📊 Все
          </button>
          <button 
            onClick={() => setActiveTab('available')}
            style={{
              padding: isMobile ? '6px 12px' : '8px 20px',
              backgroundColor: activeTab === 'available' ? '#1a2e1a' : 'transparent',
              border: 'none',
              borderRadius: '4px 4px 0 0',
              color: activeTab === 'available' ? '#4caf50' : '#666',
              fontSize: isMobile ? '11px' : '13px',
              fontWeight: activeTab === 'available' ? '500' : '400',
              cursor: 'pointer',
              borderBottom: activeTab === 'available' ? '2px solid #4caf50' : '2px solid transparent',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            ✅ Доступно
          </button>
          <button 
            onClick={() => setActiveTab('repair')}
            style={{
              padding: isMobile ? '6px 12px' : '8px 20px',
              backgroundColor: activeTab === 'repair' ? '#2a1a0a' : 'transparent',
              border: 'none',
              borderRadius: '4px 4px 0 0',
              color: activeTab === 'repair' ? '#b45309' : '#666',
              fontSize: isMobile ? '11px' : '13px',
              fontWeight: activeTab === 'repair' ? '500' : '400',
              cursor: 'pointer',
              borderBottom: activeTab === 'repair' ? '2px solid #b45309' : '2px solid transparent',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            🔧 В ремонте
          </button>
          <button 
            onClick={() => setActiveTab('rented')}
            style={{
              padding: isMobile ? '6px 12px' : '8px 20px',
              backgroundColor: activeTab === 'rented' ? '#2a0a0a' : 'transparent',
              border: 'none',
              borderRadius: '4px 4px 0 0',
              color: activeTab === 'rented' ? '#b91c1c' : '#666',
              fontSize: isMobile ? '11px' : '13px',
              fontWeight: activeTab === 'rented' ? '500' : '400',
              cursor: 'pointer',
              borderBottom: activeTab === 'rented' ? '2px solid #b91c1c' : '2px solid transparent',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            🔒 Занято
          </button>
        </div>

        {/* ===== ДВУХУРОВНЕВЫЙ СПИСОК С ФИЛЬТРАЦИЕЙ ===== */}
        {(() => {
          const filteredMainCategories = mainCategories.map(main => ({
            ...main,
            subCategories: main.subCategories?.map(sub => ({
              ...sub,
              items: sub.items?.filter(item => {
                if (activeTab === 'all') return true;
                return item.status === activeTab;
              })
            })).filter(sub => sub.items && sub.items.length > 0)
          })).filter(main => main.subCategories && main.subCategories.length > 0);

          if (filteredMainCategories.length === 0) {
            return (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#555', fontSize: '16px' }}>
                {activeTab === 'available' && '✅ Нет доступного оборудования'}
                {activeTab === 'repair' && '🔧 Нет оборудования в ремонте'}
                {activeTab === 'rented' && '🔒 Нет занятого оборудования'}
                {activeTab === 'all' && '🏷️ Нет категорий'}
              </div>
            );
          }

          return filteredMainCategories.map((mainCat) => {
            const isMainOpen = openCategories[mainCat.id] || false;
            const subs = mainCat.subCategories || [];

            return (
              <section key={mainCat.id} style={{ marginBottom: '8px' }}>
                <div
                  onClick={() => toggleCategory(mainCat.id)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: isMobile ? '8px 12px' : '12px 16px',
                    backgroundColor: '#1a1a1a',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    border: '1px solid #2a2a2a',
                    userSelect: 'none'
                  }}
                >
                  <span style={{
                    fontSize: isMobile ? '14px' : '16px',
                    fontWeight: '600',
                    color: '#e0e0e0',
                    letterSpacing: '0.5px'
                  }}>
                    {mainCat.name}
                  </span>
                  <span style={{
                    color: '#666',
                    fontSize: isMobile ? '16px' : '18px',
                    transition: 'transform 0.3s',
                    transform: isMainOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                  }}>
                    ▼
                  </span>
                </div>

                {isMainOpen && (
                  <div style={{
                    paddingLeft: isMobile ? '8px' : '16px',
                    marginTop: '4px',
                    borderLeft: '2px solid #2a2a2a'
                  }}>
                    {subs.map((sub) => {
                      const isSubOpen = openCategories[sub.id] || false;
                      const items = sub.items || [];

                      return (
                        <div key={sub.id} style={{ marginBottom: '4px' }}>
                          <div
                            onClick={() => toggleCategory(sub.id)}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: isMobile ? '4px 8px' : '6px 12px',
                              backgroundColor: '#111',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s',
                              border: '1px solid #2a2a2a',
                              userSelect: 'none'
                            }}
                          >
                            <span style={{
                              fontSize: isMobile ? '12px' : '14px',
                              fontWeight: '500',
                              color: '#aaa'
                            }}>
                              {sub.name} <span style={{ color: '#555', fontWeight: '300' }}>({items.length})</span>
                            </span>
                            <span style={{
                              color: '#555',
                              fontSize: isMobile ? '12px' : '14px',
                              transition: 'transform 0.3s',
                              transform: isSubOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                            }}>
                              ▼
                            </span>
                          </div>

                          {isSubOpen && (
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                              marginTop: '2px',
                              paddingLeft: isMobile ? '4px' : '8px',
                              borderLeft: '2px solid #1a1a1a'
                            }}>
                              {items.map((item) => {
                                const isInCart = cart.find(cartItem => cartItem.id === item.id);
                                const isRented = item.status === 'rented';
                                const isRepair = item.status === 'repair';
                                const isAvailable = item.status === 'available';

                                return (
 <div
  key={item.id}
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    padding: isMobile ? '8px 8px' : '4px 12px',
    borderRadius: '4px',
    backgroundColor: isInCart ? '#1a3a1a' : isRented ? '#2a1a1a' : 'transparent',
    borderLeft: `3px solid ${
      isInCart ? '#4caf50' :
      isRented ? '#b91c1c' :
      isAvailable ? '#4caf50' :
      '#b45309'
    }`,
    flexWrap: 'nowrap',
    gap: isMobile ? '6px' : '8px',
    alignItems: 'center',
    minHeight: isMobile ? '44px' : '32px',
    cursor: 'default'
  }}
>
  {/* ===== НАЗВАНИЕ (ВЫРАВНИВАНИЕ ПО ЛЕВОМУ КРАЮ) ===== */}
  <span style={{
    fontSize: isMobile ? '14px' : '14px',
    fontWeight: isInCart || isRented ? '500' : '400',
    color: isInCart ? '#4caf50' : isRented ? '#f44336' : '#ddd',
    flex: '1 1 auto',
    minWidth: '60px',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    hyphens: 'auto',
    lineHeight: '1.4',
    paddingRight: '8px',
    textAlign: 'left'
  }}>
    {item.name}
  </span>

  {/* ===== ПРАВАЯ ЧАСТЬ (СТАТУСЫ + КНОПКИ) ===== */}
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? '4px' : '4px',
    flexWrap: 'wrap',
    flexShrink: 0,
    justifyContent: 'flex-end'
  }}>
    {isRented && item.rented_by && (
      <span style={{ 
        color: '#888', 
        fontSize: isMobile ? '10px' : '11px',
        whiteSpace: 'nowrap'
      }}>
        👤 {item.rented_by}
        {item.rented_until && (
          <span style={{ color: '#666', fontSize: isMobile ? '8px' : '10px', marginLeft: '2px' }}>
            до {displayDate(item.rented_until)}
          </span>
        )}
        {item.booking_comment && (
          <span style={{ 
            color: '#b45309', 
            fontSize: isMobile ? '8px' : '10px', 
            marginLeft: '2px',
            fontStyle: 'italic'
          }}>
            💬 {item.booking_comment}
          </span>
        )}
      </span>
    )}

    {isRepair && item.repair_comment && (
      <button
        onClick={() => openRepairDetails(item)}
        style={{
          background: 'none',
          border: 'none',
          color: '#b45309',
          fontSize: isMobile ? '14px' : '14px',
          cursor: 'pointer',
          padding: isMobile ? '4px 6px' : '2px 4px',
          borderRadius: '4px'
        }}
        title="Нажмите, чтобы увидеть комментарий"
      >
        💬
      </button>
    )}

    {!isRented && (
      <div style={{ display: 'flex', gap: isMobile ? '4px' : '2px', flexShrink: 0 }}>
        <button
          onClick={() => finishRepair(item.id)}
          style={{
            padding: isMobile ? '4px 10px' : '2px 8px',
            fontSize: isMobile ? '11px' : '11px',
            fontWeight: '400',
            letterSpacing: '0.3px',
            borderRadius: '2px',
            border: 'none',
            backgroundColor: isAvailable ? '#4caf50' : 'transparent',
            color: isAvailable ? '#0b0b0b' : '#555',
            cursor: isAvailable ? 'default' : 'pointer',
            transition: 'color 0.2s, background-color 0.2s',
            whiteSpace: 'nowrap',
            minHeight: isMobile ? '32px' : 'auto'
          }}
          disabled={isAvailable || repairBusy}

        >
          {isRepair ? 'ИЗ РЕМОНТА' : 'НА СКЛАДЕ'}

        </button>
        <button
          onClick={() => openRepairModal(item.id)}
          style={{
            padding: isMobile ? '4px 10px' : '2px 8px',
            fontSize: isMobile ? '11px' : '11px',
            fontWeight: '400',
            letterSpacing: '0.3px',
            borderRadius: '2px',
            border: 'none',
            backgroundColor: isRepair ? '#b45309' : 'transparent',
            color: isRepair ? '#0b0b0b' : '#555',
            cursor: isRepair ? 'default' : 'pointer',
            transition: 'color 0.2s, background-color 0.2s',
            whiteSpace: 'nowrap',
            minHeight: isMobile ? '32px' : 'auto'
          }}
          disabled={isRepair || repairBusy}
        >
          РЕМОНТ
        </button>
      </div>
    )}

    {(isAvailable || isRented) && (
  <button
    title={
      isInCart
        ? 'Убрать из корзины'
        : isRented
          ? 'Выбрать даты после текущей выдачи'
          : 'Выбрать даты бронирования'
    }
    onClick={() => addToCart(item)}

        style={{
          padding: isMobile ? '4px 10px' : '2px 8px',
          fontSize: isMobile ? '11px' : '11px',
          borderRadius: '2px',
          border: '1px solid #555',
          backgroundColor: isInCart ? '#4caf50' : 'transparent',
          color: isInCart ? '#0b0b0b' : '#888',
          cursor: 'pointer',
          transition: 'all 0.2s',
          flexShrink: 0,
          minHeight: isMobile ? '32px' : 'auto'
        }}
      >
        {isInCart ? '✔' : '➕'}
      </button>
    )}

    {isRepair && (
      <span style={{
        padding: isMobile ? '4px 8px' : '2px 6px',
        fontSize: isMobile ? '11px' : '11px',
        borderRadius: '2px',
        border: '1px solid #444',
        color: '#444',
        opacity: 0.3,
        cursor: 'default',
        flexShrink: 0,
        minHeight: isMobile ? '32px' : 'auto',
        display: 'flex',
        alignItems: 'center'
      }}>
        ➕
      </span>
    )}
  </div>
</div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          });
        })()}
      </div>

      {/* ===== МОДАЛЬНЫЕ ОКНА ===== */}
      {showCart && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#0b0b0b',
          zIndex: 1500,
          overflow: 'auto',
          padding: isMobile ? '10px' : '20px'
        }}>
          <CartPage
            cart={cart}
            setCart={setCart}
            onClose={() => setShowCart(false)}
            onBookingComplete={() => {
  setShowCart(false);
  setCart([]);
  return loadEquipment();
}}

            currentUser={currentUser}
          />

        </div>
      )}

      {showMyBookings && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#0b0b0b',
          zIndex: 1500,
          overflow: 'auto',
          padding: isMobile ? '10px' : '20px'
        }}>
          <MyBookings
  currentUser={currentUser}
  onBookingsChanged={loadEquipment}
  onClose={() => setShowMyBookings(false)}
/>

        </div>
      )}

      {showRepairModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '450px',
            width: '90%'
          }}>
            <h3 style={{ color: '#fff', marginTop: 0, fontSize: isMobile ? '16px' : '18px' }}>
              🔧 Отправка в ремонт
            </h3>
            
            <p style={{ color: '#888', fontSize: '14px', marginBottom: '16px' }}>
              Опишите, что сломалось или что нужно починить:
            </p>
            <p style={{ color: '#e0ae61', fontSize: '13px' }}>
  Существующие брони сохранятся, но выдача будет заблокирована
  до окончания ремонта. При необходимости согласуйте отмену
  с владельцами броней.
</p>

            
            <textarea
              maxLength={2000}
              disabled={repairBusy}
              value={repairComment}
              onChange={(e) => setRepairComment(e.target.value)}
              placeholder="Например: не фокусируется объектив, трещина на корпусе..."
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '10px',
                backgroundColor: '#0b0b0b',
                border: '1px solid #333',
                borderRadius: '6px',
                color: '#e0e0e0',
                fontSize: '14px',
                resize: 'vertical',
                outline: 'none',
                fontFamily: 'inherit'

              }}
              autoFocus
            />
            
            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: '20px'
            }}>
              <button
                onClick={() => {
                  setShowRepairModal(false);
                  setRepairItemId(null);
                  setRepairComment('');
                }}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#333',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#aaa',
                  fontSize: '14px',
                  cursor: 'pointer'

                }}
                disabled={repairBusy}
              >
                Отмена
              </button>
              <button
                onClick={confirmRepair}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#b45309',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
                disabled={repairBusy}
              >
                {repairBusy ? 'Сохранение…' : '✅ Отправить в ремонт'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRepairDetails && repairDetailsItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '450px',
            width: '90%'
          }}>
            <h3 style={{ color: '#fff', marginTop: 0, fontSize: isMobile ? '16px' : '18px' }}>
              🔧 Детали ремонта
            </h3>
            
            <div style={{ marginBottom: '16px' }}>
              <p style={{ color: '#888', fontSize: '13px', marginBottom: '4px' }}>
                📦 Оборудование
              </p>
              <p style={{ color: '#e0e0e0', fontSize: '15px', fontWeight: '500' }}>
                {repairDetailsItem.name}
              </p>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <p style={{ color: '#888', fontSize: '13px', marginBottom: '4px' }}>
                👤 Отправил в ремонт
              </p>
              <p style={{ color: '#b45309', fontSize: '15px' }}>
                {repairDetailsItem.repaired_by || 'Неизвестно'}
              </p>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <p style={{ color: '#888', fontSize: '13px', marginBottom: '4px' }}>
                💬 Комментарий
              </p>
              <div style={{
                backgroundColor: '#0b0b0b',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #2a2a2a',
                color: '#e0e0e0',
                fontSize: '14px',
                lineHeight: '1.5',
                minHeight: '40px'
              }}>
                {repairDetailsItem.repair_comment}
              </div>
            </div>
            
            <button
              onClick={() => {
                setShowRepairDetails(false);
                setRepairDetailsItem(null);
              }}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#333',
                border: 'none',
                borderRadius: '6px',
                color: '#aaa',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {showEditor && (
        <EditorPanel
          onClose={() => setShowEditor(false)}
          onUpdate={(updatedData) => {
            if (updatedData) {
              setMainCategories(updatedData);
            } else {
              loadEquipment();
            }
            setShowEditor(false);
          }}
          initialData={mainCategories}
        />
      )}
    </div>
  );
}

export default EquipmentList;