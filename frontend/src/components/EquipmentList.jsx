import React, { useEffect, useState } from 'react';
import axios from 'axios';
import CartPage from './CartPage';
import MyBookings from './MyBookings';
import EditorPanel from './EditorPanel';
const API_URL = 'https://studio-app-backend-bhcs.onrender.com';

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

  const loadEquipment = async () => {
  try {
    setLoading(true);
    console.log('🟢 Загружаем данные...');
    
    // ===== ЖЁСТКО ПРОПИСЫВАЕМ URL БЭКЕНДА =====
    const API_URL = 'https://studio-app-backend-bhcs.onrender.com';
    const response = await axios.get(`${API_URL}/api/full-hierarchy`);
    
    console.log('✅ Данные загружены:', response.data.length, 'категорий');
    setMainCategories(response.data);
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

  // ===== ИЗМЕНЕНИЕ СТАТУСА =====
  const changeStatus = async (id, newStatus) => {
    try {
      await axios.patch(`/api/equipment/${id}/status`, { status: newStatus });
      loadEquipment();
    } catch (err) {
      alert('Ошибка при изменении статуса: ' + err.message);
    }
  };

  // ===== РЕМОНТ =====
  const openRepairModal = (id) => {
    setRepairItemId(id);
    setRepairComment('');
    setShowRepairModal(true);
  };

  const confirmRepair = async () => {
  if (!repairItemId) return;
  
  try {
    await axios.patch(`/api/equipment/${repairItemId}/status`, {
      status: 'repair',
      repairComment: repairComment.trim() || 'Не указано',
      rentedBy: currentUser
    });
    
    // ===== ЛОКАЛЬНОЕ ОБНОВЛЕНИЕ (без перезагрузки) =====
    setMainCategories(prevCategories =>
      prevCategories.map(main => ({
        ...main,
        subCategories: main.subCategories?.map(sub => ({
          ...sub,
          items: sub.items?.map(item =>
            item.id === repairItemId
              ? { 
                  ...item, 
                  status: 'repair', 
                  repair_comment: repairComment.trim() || 'Не указано',
                  repaired_by: currentUser,
                  rented_by: null, 
                  rented_until: null,
                  booking_comment: null
                }
              : item
          )
        }))
      }))
    );
    
    setShowRepairModal(false);
    setRepairItemId(null);
    setRepairComment('');
    
    // Если предмет был в корзине — удаляем
    if (cart.find(item => item.id === repairItemId)) {
      setCart(prev => prev.filter(item => item.id !== repairItemId));
    }
  } catch (err) {
    alert('Ошибка при отправке в ремонт: ' + err.message);
  }
};
  const openRepairDetails = (item) => {
    setRepairDetailsItem(item);
    setShowRepairDetails(true);
  };

  // ===== КОРЗИНА =====
  const addToCart = (item) => {
    if (cart.find(cartItem => cartItem.id === item.id)) {
      setCart(prev => prev.filter(cartItem => cartItem.id !== item.id));
      return;
    }
    
    if (item.status !== 'available') {
      alert('Это оборудование сейчас недоступно');
      return;
    }
    
    setCart([...cart, item]);
  };

  useEffect(() => {
    loadEquipment();
  }, []);

  const totalItems = mainCategories.reduce((acc, main) => {
    const subs = main.subCategories || [];
    return acc + subs.reduce((subAcc, sub) => subAcc + (sub.items || []).length, 0);
  }, 0);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#aaa' }}>⏳ Загрузка...</div>;
  }

  if (error) {
    return <div style={{ color: '#f44336', textAlign: 'center', padding: '40px' }}>{error}</div>;
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0b0b0b',
      color: '#e0e0e0',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '20px 20px 40px'
      }}>
        {/* ===== ШАПКА ===== */}
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #2a2a2a',
          paddingBottom: '16px',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <h1 
              style={{
                fontSize: '24px',
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
              }}
            >
              ОБОРУДОВАНИЕ <span style={{ color: '#666', fontWeight: '200' }}>| КАМФИЛЬМ</span>
            </h1>
            <p style={{
              fontSize: '13px',
              color: '#555',
              margin: '6px 0 0 0',
              letterSpacing: '0.5px'
            }}>
              {totalItems} позиций
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              display: 'flex',
              gap: '12px',
              fontSize: '12px',
              color: '#555'
            }}>
              <span>● ДОСТУПНО</span>
              <span style={{ color: '#b45309' }}>● РЕМОНТ</span>
              <span style={{ color: '#b91c1c' }}>● ЗАНЯТО</span>
            </div>

            <button
              onClick={() => setShowMyBookings(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '20px',
                color: '#e0e0e0',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#2a2a2a';
                e.target.style.borderColor = '#555';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#1a1a1a';
                e.target.style.borderColor = '#333';
              }}
            >
              📋 Мои бронирования
            </button>

            <button
              onClick={() => setShowCart(true)}
              style={{
                position: 'relative',
                padding: '8px 16px',
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '20px',
                color: '#e0e0e0',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#2a2a2a';
                e.target.style.borderColor = '#555';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#1a1a1a';
                e.target.style.borderColor = '#333';
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
                  fontSize: '11px',
                  fontWeight: '600',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
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

        {/* ===== ВКЛАДКИ ===== */}
        <div style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '20px',
          borderBottom: '1px solid #2a2a2a',
          paddingBottom: '4px',
          flexWrap: 'wrap'
        }}>
          <button 
            onClick={() => setActiveTab('all')}
            style={{
              padding: '8px 20px',
              backgroundColor: activeTab === 'all' ? '#2a2a2a' : 'transparent',
              border: 'none',
              borderRadius: '4px 4px 0 0',
              color: activeTab === 'all' ? '#fff' : '#666',
              fontSize: '13px',
              fontWeight: activeTab === 'all' ? '500' : '400',
              cursor: 'pointer',
              borderBottom: activeTab === 'all' ? '2px solid #4caf50' : '2px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            📊 Все
          </button>
          <button 
            onClick={() => setActiveTab('available')}
            style={{
              padding: '8px 20px',
              backgroundColor: activeTab === 'available' ? '#1a2e1a' : 'transparent',
              border: 'none',
              borderRadius: '4px 4px 0 0',
              color: activeTab === 'available' ? '#4caf50' : '#666',
              fontSize: '13px',
              fontWeight: activeTab === 'available' ? '500' : '400',
              cursor: 'pointer',
              borderBottom: activeTab === 'available' ? '2px solid #4caf50' : '2px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            ✅ Доступно
          </button>
          <button 
            onClick={() => setActiveTab('repair')}
            style={{
              padding: '8px 20px',
              backgroundColor: activeTab === 'repair' ? '#2a1a0a' : 'transparent',
              border: 'none',
              borderRadius: '4px 4px 0 0',
              color: activeTab === 'repair' ? '#b45309' : '#666',
              fontSize: '13px',
              fontWeight: activeTab === 'repair' ? '500' : '400',
              cursor: 'pointer',
              borderBottom: activeTab === 'repair' ? '2px solid #b45309' : '2px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            🔧 В ремонте
          </button>
          <button 
            onClick={() => setActiveTab('rented')}
            style={{
              padding: '8px 20px',
              backgroundColor: activeTab === 'rented' ? '#2a0a0a' : 'transparent',
              border: 'none',
              borderRadius: '4px 4px 0 0',
              color: activeTab === 'rented' ? '#b91c1c' : '#666',
              fontSize: '13px',
              fontWeight: activeTab === 'rented' ? '500' : '400',
              cursor: 'pointer',
              borderBottom: activeTab === 'rented' ? '2px solid #b91c1c' : '2px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            🔒 Занято
          </button>
        </div>

        {/* ===== ДВУХУРОВНЕВЫЙ СПИСОК С ФИЛЬТРАЦИЕЙ ===== */}
        {(() => {
          // Фильтруем предметы по статусу
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
                {/* Заголовок главной категории */}
                <div
                  onClick={() => toggleCategory(mainCat.id)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    backgroundColor: '#1a1a1a',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                    border: '1px solid #2a2a2a',
                    userSelect: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                >
                  <span style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#e0e0e0',
                    letterSpacing: '1px'
                  }}>
                    {mainCat.name}
                  </span>
                  <span style={{
                    color: '#666',
                    fontSize: '18px',
                    transition: 'transform 0.3s',
                    transform: isMainOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                  }}>
                    ▼
                  </span>
                </div>

                {/* Подкатегории */}
                {isMainOpen && (
                  <div style={{
                    paddingLeft: '16px',
                    marginTop: '4px',
                    borderLeft: '2px solid #2a2a2a'
                  }}>
                    {subs.map((sub) => {
                      const isSubOpen = openCategories[sub.id] || false;
                      const items = sub.items || [];

                      return (
                        <div key={sub.id} style={{ marginBottom: '4px' }}>
                          {/* Заголовок подкатегории */}
                          <div
                            onClick={() => toggleCategory(sub.id)}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '6px 12px',
                              backgroundColor: '#111',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s',
                              border: '1px solid #2a2a2a',
                              userSelect: 'none'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#111'}
                          >
                            <span style={{
                              fontSize: '14px',
                              fontWeight: '500',
                              color: '#aaa'
                            }}>
                              {sub.name} <span style={{ color: '#555', fontWeight: '300' }}>({items.length})</span>
                            </span>
                            <span style={{
                              color: '#555',
                              fontSize: '14px',
                              transition: 'transform 0.3s',
                              transform: isSubOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                            }}>
                              ▼
                            </span>
                          </div>

                          {/* Предметы */}
                          {isSubOpen && (
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                              marginTop: '2px',
                              paddingLeft: '8px',
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
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '4px 12px',
                                      borderRadius: '4px',
                                      backgroundColor: isInCart ? '#1a3a1a' : isRented ? '#2a1a1a' : 'transparent',
                                      borderLeft: `3px solid ${
                                        isInCart ? '#4caf50' :
                                        isRented ? '#b91c1c' :
                                        isAvailable ? '#4caf50' :
                                        '#b45309'
                                      }`,
                                      flexWrap: 'wrap',
                                      gap: '4px'
                                    }}
                                  >
                                    <span style={{
                                      fontSize: '14px',
                                      fontWeight: isInCart || isRented ? '500' : '400',
                                      color: isInCart ? '#4caf50' : isRented ? '#f44336' : '#ddd'
                                    }}>
                                      {item.name}
                                    </span>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                      {isRented && item.rented_by && (
                                        <span style={{ color: '#888', fontSize: '12px' }}>
                                          👤 {item.rented_by}
                                          {item.rented_until && (
                                            <span style={{ color: '#666', fontSize: '11px', marginLeft: '4px' }}>
                                              до {new Date(item.rented_until).toLocaleDateString()}
                                            </span>
                                          )}
                                          {item.booking_comment && (
                                            <span style={{ 
                                              color: '#b45309', 
                                              fontSize: '11px', 
                                              marginLeft: '8px',
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
                                            fontSize: '14px',
                                            cursor: 'pointer',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            transition: 'background-color 0.2s'
                                          }}
                                          onMouseEnter={(e) => e.target.style.backgroundColor = '#2a1a0a'}
                                          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                          title="Нажмите, чтобы увидеть комментарий"
                                        >
                                          💬
                                        </button>
                                      )}

                                      {!isRented && (
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                          <button
                                            onClick={() => changeStatus(item.id, 'available')}
                                            style={{
                                              padding: '2px 8px',
                                              fontSize: '11px',
                                              fontWeight: '400',
                                              letterSpacing: '0.3px',
                                              borderRadius: '2px',
                                              border: 'none',
                                              backgroundColor: isAvailable ? '#4caf50' : 'transparent',
                                              color: isAvailable ? '#0b0b0b' : '#555',
                                              cursor: isAvailable ? 'default' : 'pointer',
                                              transition: 'color 0.2s, background-color 0.2s'
                                            }}
                                            disabled={isAvailable}
                                            onMouseEnter={(e) => {
                                              if (!isAvailable) {
                                                e.target.style.color = '#4caf50';
                                                e.target.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
                                              }
                                            }}
                                            onMouseLeave={(e) => {
                                              if (!isAvailable) {
                                                e.target.style.color = '#555';
                                                e.target.style.backgroundColor = 'transparent';
                                              }
                                            }}
                                          >
                                            ДОСТУПЕН
                                          </button>
                                          <button
                                            onClick={() => openRepairModal(item.id)}
                                            style={{
                                              padding: '2px 8px',
                                              fontSize: '11px',
                                              fontWeight: '400',
                                              letterSpacing: '0.3px',
                                              borderRadius: '2px',
                                              border: 'none',
                                              backgroundColor: isRepair ? '#b45309' : 'transparent',
                                              color: isRepair ? '#0b0b0b' : '#555',
                                              cursor: isRepair ? 'default' : 'pointer',
                                              transition: 'color 0.2s, background-color 0.2s'
                                            }}
                                            disabled={isRepair}
                                            onMouseEnter={(e) => {
                                              if (!isRepair) {
                                                e.target.style.color = '#b45309';
                                                e.target.style.backgroundColor = 'rgba(180, 83, 9, 0.1)';
                                              }
                                            }}
                                            onMouseLeave={(e) => {
                                              if (!isRepair) {
                                                e.target.style.color = '#555';
                                                e.target.style.backgroundColor = 'transparent';
                                              }
                                            }}
                                          >
                                            РЕМОНТ
                                          </button>
                                        </div>
                                      )}

                                      {isAvailable && (
                                        <button
                                          onClick={() => addToCart(item)}
                                          style={{
                                            padding: '2px 8px',
                                            fontSize: '11px',
                                            borderRadius: '2px',
                                            border: '1px solid #555',
                                            backgroundColor: isInCart ? '#4caf50' : 'transparent',
                                            color: isInCart ? '#0b0b0b' : '#888',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                          }}
                                        >
                                          {isInCart ? '✔' : '➕'}
                                        </button>
                                      )}

                                      {isRepair && (
                                        <span style={{
                                          padding: '2px 8px',
                                          fontSize: '11px',
                                          borderRadius: '2px',
                                          border: '1px solid #444',
                                          color: '#444',
                                          opacity: 0.3,
                                          cursor: 'default'
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
          padding: '20px'
        }}>
          <CartPage 
            cart={cart}
            setCart={setCart}
            onClose={() => setShowCart(false)}
            onBookingComplete={() => {
              setShowCart(false);
              setCart([]);
              const bookedIds = cart.map(item => item.id);
              setMainCategories(prevCategories => 
                prevCategories.map(main => ({
                  ...main,
                  subCategories: main.subCategories?.map(sub => ({
                    ...sub,
                    items: sub.items?.map(item => 
                      bookedIds.includes(item.id) 
                        ? { ...item, status: 'rented', rented_by: currentUser, rented_until: new Date().toISOString().split('T')[0] }
                        : item
                    )
                  }))
                }))
              );
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
          padding: '20px'
        }}>
          <MyBookings
            currentUser={currentUser}
            onClose={() => setShowMyBookings(false)}
            onReturnComplete={(returnedId) => {
              if (returnedId === null) {
                setMainCategories(prevCategories =>
                  prevCategories.map(main => ({
                    ...main,
                    subCategories: main.subCategories?.map(sub => ({
                      ...sub,
                      items: sub.items?.map(item =>
                        item.status === 'rented' && item.rented_by === currentUser
                          ? { ...item, status: 'available', rented_by: null, rented_until: null, booking_comment: null }
                          : item
                      )
                    }))
                  }))
                );
                setShowMyBookings(false);
              } else {
                setMainCategories(prevCategories =>
                  prevCategories.map(main => ({
                    ...main,
                    subCategories: main.subCategories?.map(sub => ({
                      ...sub,
                      items: sub.items?.map(item =>
                        item.id === returnedId
                          ? { ...item, status: 'available', rented_by: null, rented_until: null, booking_comment: null }
                          : item
                      )
                    }))
                  }))
                );
              }
            }}
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
            width: '100%'
          }}>
            <h3 style={{ color: '#fff', marginTop: 0, fontSize: '18px' }}>
              🔧 Отправка в ремонт
            </h3>
            
            <p style={{ color: '#888', fontSize: '14px', marginBottom: '16px' }}>
              Опишите, что сломалось или что нужно починить:
            </p>
            
            <textarea
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
              >
                ✅ Отправить в ремонт
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
            width: '100%'
          }}>
            <h3 style={{ color: '#fff', marginTop: 0, fontSize: '18px' }}>
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