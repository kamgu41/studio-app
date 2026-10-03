import React, { useState, useEffect, useRef } from 'react';
import axios from '../api';
import { getEditorCategoryRows } from "./editorCategoryRows.js";

const API_URL = '';

function EditorPanel({ onClose, onUpdate, initialData }) {
  const [mainCategories, setMainCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  
  const [openCategories, setOpenCategories] = useState({});
  const [editingSub, setEditingSub] = useState(null);
  const [editingSubValue, setEditingSubValue] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [editingItemValue, setEditingItemValue] = useState('');
  const [movingItem, setMovingItem] = useState(null);
  const [movingItemTarget, setMovingItemTarget] = useState('');
  const [showAddSub, setShowAddSub] = useState(null);
  const [newSubName, setNewSubName] = useState('');
  const [showAddItem, setShowAddItem] = useState(null);
  const [newItemName, setNewItemName] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [newSubParentId, setNewSubParentId] = useState('');
  const [addingSub, setAddingSub] = useState(false);
  const addingSubRef = useRef(false);
  const [closing, setClosing] = useState(false);

  // ===== ИНИЦИАЛИЗАЦИЯ =====
  const initialDataRef = useRef(initialData);

  useEffect(() => {
    let ignore = false;
    const startingData = initialDataRef.current;

    if (Array.isArray(startingData) && startingData.length > 0) {
      setMainCategories(JSON.parse(JSON.stringify(startingData)));
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);

      try {
        const response = await axios.get(
          `${API_URL}/api/full-hierarchy`
        );

        if (!Array.isArray(response.data)) {
          throw new Error('Сервер вернул некорректный список категорий');
        }

        if (!ignore) {
          setMainCategories(response.data);
          setMessage('');
        }
      } catch (err) {
        if (!ignore) {
          setMessage(
            '❌ Ошибка загрузки: ' +
            (err.response?.data?.error || err.message)
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      ignore = true;
    };
  }, []);

  // ===== ОБНОВЛЕНИЕ ПОСЛЕ ИЗМЕНЕНИЙ =====
  const markChanged = () => setHasChanges(true);

  // ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
  const toggleCategory = (id) => {
    setOpenCategories(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const findSubCategory = (subId) => {
    for (const main of mainCategories) {
      const sub = main.subCategories?.find(s => s.id === subId);
      if (sub) return { main, sub };
    }
    return null;
  };

  const handleAddSubCategory = async (mainId) => {
  if (addingSubRef.current) return;

  const name = newSubName.trim();

  if (!name) {
    setMessage('Введите название подраздела');
    return;
  }

  const main = mainCategories.find(category => category.id === mainId);
  const parentId = newSubParentId || null;

  if (!main) {
    setMessage('❌ Основная категория не найдена');
    return;
  }

  if (
    parentId &&
    !(main.subCategories || []).some(sub => sub.id === parentId)
  ) {
    setMessage('❌ Выберите родителя в этой основной категории');
    return;
  }

  addingSubRef.current = true;
  setAddingSub(true);

  try {
    const response = await axios.post(`${API_URL}/api/sub-category`, {
      name,
      main_category_id: mainId,
      parent_id: parentId,
    });

    const newSub = response.data?.data;

    if (!newSub?.id) {
      throw new Error(
        'Сервер не вернул созданный раздел. Обновите страницу перед повторной попыткой.'
      );
    }

    setMainCategories(prev => prev.map(category => (
      category.id === mainId
        ? {
            ...category,
            subCategories: [
              ...(category.subCategories || []),
              { ...newSub, items: [] },
            ],
          }
        : category
    )));

    setOpenCategories(prev => ({
      ...prev,
      [mainId]: true,
      ...(parentId ? { [parentId]: true } : {}),
      [newSub.id]: true,
    }));

    markChanged();
    setNewSubName('');
    setNewSubParentId('');
    setShowAddSub(null);

    if ((newSub.parent_id || null) !== parentId) {
      setMessage(
        '❌ Сервер создал раздел не у выбранного родителя. ' +
        'Не повторяйте создание: проверьте обновление server.js.'
      );
    } else {
      setMessage('✅ Подраздел добавлен');
    }
  } catch (err) {
    setMessage('❌ Ошибка: ' + (err.response?.data?.error || err.message));
  } finally {
    addingSubRef.current = false;
    setAddingSub(false);
  }
};


  const handleRenameSub = async (id) => {
    if (!editingSubValue.trim()) {
      setMessage('Введите новое название');
      return;
    }

    try {
      await axios.patch(`${API_URL}/api/sub-category/${id}`, {
        name: editingSubValue.trim()
      });
      
      setMainCategories(prev => prev.map(main => ({
        ...main,
        subCategories: main.subCategories?.map(sub => 
          sub.id === id ? { ...sub, name: editingSubValue.trim() } : sub
        )
      })));
      
      setEditingSub(null);
      setEditingSubValue('');
      setMessage(`✅ Подкатегория переименована`);
      markChanged();
    } catch (err) {
      setMessage('❌ Ошибка: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteSub = async (id, name) => {
    const found = findSubCategory(id);
    if (
  found &&
  (found.main.subCategories || []).some(sub => sub.parent_id === id)
) {
  setMessage('❌ Нельзя удалить раздел с дочерними подразделами');
  return;
}

    if (found && found.sub.items?.length > 0) {
      setMessage('❌ Нельзя удалить непустую подкатегорию');
      return;
    }
    
    if (!window.confirm(`Удалить подкатегорию "${name}"? Это можно сделать только если она пуста.`)) return;

    try {
      await axios.delete(`${API_URL}/api/sub-category/${id}`);
      
      setMainCategories(prev => prev.map(main => ({
        ...main,
        subCategories: main.subCategories?.filter(sub => sub.id !== id)
      })));
      
      setMessage(`✅ Подкатегория "${name}" удалена`);
      markChanged();
    } catch (err) {
      setMessage('❌ Ошибка: ' + (err.response?.data?.error || err.message));
    }
  };

 const handleAddItem = async (subId) => {
  if (!newItemName.trim()) {
    setMessage('Введите название предмета');
    return;
  }

  try {
    // 1. Создаём предмет
    const response = await axios.post(`${API_URL}/api/equipment`, {
      name: newItemName.trim(),
      description: 'Временная категория',
      status: 'available',
      sub_category_id: subId
    });
    
    const newItem = response.data;
    console.log('✅ Создан предмет с ID:', newItem.id);

    // 2. Обновляем локальное состояние с правильным ID
    setMainCategories(prev => prev.map(main => ({
      ...main,
      subCategories: main.subCategories?.map(sub => 
        sub.id === subId 
          ? { ...sub, items: [...(sub.items || []), newItem] }
          : sub
      )
    })));
    
    setNewItemName('');
    setShowAddItem(null);
    setMessage(`✅ Предмет "${newItem.name}" добавлен`);
    markChanged();
  } catch (err) {
    console.error('❌ Ошибка:', err);
    setMessage('❌ Ошибка: ' + (err.response?.data?.error || err.message));
  }
};

  const handleRenameItem = async (id) => {
    if (!editingItemValue.trim()) {
      setMessage('Введите новое название');
      return;
    }

    try {
      await axios.patch(`${API_URL}/api/equipment/${id}/rename`, {
        newName: editingItemValue.trim()
      });
      
      setMainCategories(prev => prev.map(main => ({
        ...main,
        subCategories: main.subCategories?.map(sub => ({
          ...sub,
          items: sub.items?.map(item => 
            item.id === id ? { ...item, name: editingItemValue.trim() } : item
          )
        }))
      })));
      
      setEditingItem(null);
      setEditingItemValue('');
      setMessage(`✅ Название изменено`);
      markChanged();
    } catch (err) {
      setMessage('❌ Ошибка: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleMoveItem = async (id) => {
    if (!movingItemTarget) {
      setMessage('Выберите подкатегорию');
      return;
    }

    try {
      await axios.patch(`${API_URL}/api/equipment/${id}/move-sub`, {
        newSubCategoryId: movingItemTarget
      });
      
      // Находим предмет и перемещаем его
      let movedItem = null;
      setMainCategories(prev => {
        const newState = prev.map(main => ({
          ...main,
          subCategories: main.subCategories?.map(sub => ({
            ...sub,
            items: sub.items?.filter(item => {
              if (item.id === id) {
                movedItem = item;
                return false;
              }
              return true;
            })
          }))
        }));
        
        // Добавляем в новую подкатегорию
        return newState.map(main => ({
          ...main,
          subCategories: main.subCategories?.map(sub => 
            sub.id === movingItemTarget && movedItem
              ? { ...sub, items: [...(sub.items || []), { ...movedItem, sub_category_id: movingItemTarget }] }
              : sub
          )
        }));
      });
      
      setMovingItem(null);
      setMovingItemTarget('');
      setMessage(`✅ Предмет перемещён`);
      markChanged();
    } catch (err) {
      setMessage('❌ Ошибка: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteItem = async (id, name) => {
    if (!window.confirm(`Удалить предмет "${name}"? Это действие НЕОБРАТИМО.`)) return;

    try {
      await axios.delete(`${API_URL}/api/equipment/${id}`);
      
      setMainCategories(prev => prev.map(main => ({
        ...main,
        subCategories: main.subCategories?.map(sub => ({
          ...sub,
          items: sub.items?.filter(item => item.id !== id)
        }))
      })));
      
      setMessage(`✅ Предмет "${name}" удалён`);
      markChanged();
    } catch (err) {
      setMessage('❌ Ошибка: ' + (err.response?.data?.error || err.message));
    }
  };

  // ===== СОХРАНЕНИЕ И ЗАКРЫТИЕ =====
  const handleClose = async () => {
  if (closing || addingSubRef.current) return;

  if (!hasChanges) {
    onUpdate(null);
    onClose();
    return;
  }

  setClosing(true);

  try {
    const response = await axios.get(`${API_URL}/api/full-hierarchy`);

    if (!Array.isArray(response.data)) {
      throw new Error('Сервер вернул некорректный каталог');
    }

    onUpdate(response.data);
    onClose();
  } catch (err) {
    setMessage(
      '❌ Изменения уже сохранены, но обновить каталог не удалось: ' +
      (err.response?.data?.error || err.message) +
      '. Попробуйте закрыть редактор ещё раз.'
    );
  } finally {
    setClosing(false);
  }
};


  const totalItems = mainCategories.reduce((acc, main) => {
    const subs = main.subCategories || [];
    return acc + subs.reduce((subAcc, sub) => subAcc + (sub.items || []).length, 0);
  }, 0);

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#0b0b0b',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#aaa'
      }}>
        ⏳ Загрузка...
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#0b0b0b',
      zIndex: 2000,
      overflow: 'auto',
      padding: '40px 20px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '20px'
      }}>
        {/* ===== ШАПКА ===== */}
        <div style={{
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
            <h1 style={{
              fontSize: '24px',
              fontWeight: '300',
              letterSpacing: '2px',
              margin: 0,
              color: '#ffffff'
            }}>
              ⚙️ РЕДАКТОР <span style={{ color: '#666', fontWeight: '200' }}>| КАМФИЛЬМ</span>
            </h1>
            <p style={{ fontSize: '13px', color: '#555', margin: '6px 0 0 0' }}>
              {totalItems} позиций
              {hasChanges && <span style={{ color: '#ffc107', marginLeft: '12px' }}>● Изменения отправлены на сервер</span>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleClose}
              disabled={closing || addingSub}
              style={{
                padding: '8px 20px',
                backgroundColor: hasChanges ? '#4caf50' : '#333',
                border: 'none',
                borderRadius: '4px',
                color: hasChanges ? '#0b0b0b' : '#aaa',
                fontSize: '14px',
                fontWeight: hasChanges ? '500' : '400',
                cursor: 'pointer'
              }}
            >
              {closing
  ? 'Обновляем каталог…'
  : hasChanges
    ? '✅ Готово — закрыть'
    : '✕ Закрыть'}

            </button>
          </div>
        </div>

        {message && (
          <div style={{
            padding: '12px',
            backgroundColor: message.includes('✅') ? '#1a3a1a' : '#2a1a1a',
            borderRadius: '6px',
            color: message.includes('✅') ? '#4caf50' : '#f44336',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            {message}
          </div>
        )}
<fieldset
  disabled={closing}
  style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
>

        {/* ===== СПИСОК КАТЕГОРИЙ ===== */}
        {mainCategories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#555', fontSize: '16px' }}>
            🏷️ Нет категорий.
          </div>
        ) : (
          mainCategories.map((mainCat) => {
            const isMainOpen = openCategories[mainCat.id] || false;
            const subs = getEditorCategoryRows(mainCat);

            return (
              <section key={mainCat.id} style={{ marginBottom: '8px' }}>
                {/* ===== ЗАГОЛОВОК ГЛАВНОЙ КАТЕГОРИИ ===== */}
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

                {/* ===== ПОДКАТЕГОРИИ ===== */}
                {isMainOpen && (
                  <div style={{
                    paddingLeft: '16px',
                    marginTop: '4px',
                    borderLeft: '2px solid #2a2a2a'
                  }}>
                    {subs
  .filter(sub =>
    sub.editorAncestors.every(id => openCategories[id])
  )
  .map((sub) => {

                      const isSubOpen = openCategories[sub.id] || false;
                      const items = sub.items || [];
                      const isEditing = editingSub === sub.id;
                      const cannotDeleteSub =
                        items.length > 0 || sub.editorHasChildren;


                      return (
                        <div
  key={sub.id}
  style={{
    marginBottom: 4,
    marginLeft: Math.min(sub.editorDepth, 6) * 16,
  }}
>

                          {/* ===== ЗАГОЛОВОК ПОДКАТЕГОРИИ ===== */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '6px 12px',
                              backgroundColor: '#111',
                              borderRadius: '4px',
                              border: '1px solid #2a2a2a',
                              flexWrap: 'wrap',
                              gap: '4px'
                            }}
                          >
                            <div
                              onClick={() => toggleCategory(sub.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                cursor: 'pointer',
                                flex: 1,
                                userSelect: 'none'
                              }}
                            >
                              <span style={{
                                fontSize: '14px',
                                fontWeight: '500',
                                color: '#aaa'
                              }}>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editingSubValue}
                                    onChange={(e) => setEditingSubValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleRenameSub(sub.id);
                                      if (e.key === 'Escape') {
                                        setEditingSub(null);
                                        setEditingSubValue('');
                                      }
                                    }}
                                    autoFocus
                                    style={{
                                      backgroundColor: '#0b0b0b',
                                      border: '1px solid #4caf50',
                                      borderRadius: '4px',
                                      color: '#e0e0e0',
                                      padding: '2px 8px',
                                      fontSize: '14px',
                                      outline: 'none',
                                      width: '200px'
                                    }}
                                  />
                                ) : (
                                  sub.name
                                )}
                                <span style={{ color: '#555', fontWeight: '300' }}>({items.length})</span>
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

                            <div style={{ display: 'flex', gap: '4px' }}>
                              {!isEditing && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingSub(sub.id);
                                      setEditingSubValue(sub.name);
                                    }}
                                    style={{
                                      padding: '2px 10px',
                                      backgroundColor: 'transparent',
                                      border: '1px solid #555',
                                      borderRadius: '4px',
                                      color: '#888',
                                      fontSize: '12px',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.target.style.borderColor = '#4caf50';
                                      e.target.style.color = '#4caf50';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.target.style.borderColor = '#555';
                                      e.target.style.color = '#888';
                                    }}
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSub(sub.id, sub.name)}
                                    style={{
                                      padding: '2px 10px',
                                      backgroundColor: 'transparent',
                                      border: '1px solid #555',
                                      borderRadius: '4px',
                                      color: cannotDeleteSub ? '#444' : '#888',
                                      fontSize: '12px',
                                      cursor: cannotDeleteSub ? 'default' : 'pointer',
                                      transition: 'all 0.2s',
                                      opacity: cannotDeleteSub ? 0.3 : 1
                                    }}
                                    disabled={cannotDeleteSub}
                                    title={
  cannotDeleteSub
    ? 'Сначала переместите оборудование и удалите дочерние разделы'
    : 'Удалить пустой подраздел'
}

                                  >
                                    ✕
                                  </button>
                                </>
                              )}
                              {isEditing && (
                                <>
                                  <button
                                    onClick={() => handleRenameSub(sub.id)}
                                    style={{
                                      padding: '2px 10px',
                                      backgroundColor: '#4caf50',
                                      border: 'none',
                                      borderRadius: '4px',
                                      color: '#0b0b0b',
                                      fontSize: '12px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    💾
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingSub(null);
                                      setEditingSubValue('');
                                    }}
                                    style={{
                                      padding: '2px 10px',
                                      backgroundColor: '#333',
                                      border: 'none',
                                      borderRadius: '4px',
                                      color: '#aaa',
                                      fontSize: '12px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    ✕
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* ===== ПРЕДМЕТЫ ===== */}
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
                                const isEditingItem = editingItem === item.id;
                                const isMoving = movingItem === item.id;
                                const isRented = item.status === 'rented';

                                return (
                                  <div
                                    key={item.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '4px 12px',
                                      borderRadius: '4px',
                                      backgroundColor: isRented ? '#2a1a1a' : 'transparent',
                                      borderLeft: `3px solid ${
                                        isRented ? '#b91c1c' :
                                        item.status === 'available' ? '#4caf50' : '#b45309'
                                      }`,
                                      flexWrap: 'wrap',
                                      gap: '4px'
                                    }}
                                  >
                                    <span style={{
                                      fontSize: '14px',
                                      color: isRented ? '#f44336' : '#ddd',
                                      fontWeight: isRented ? '500' : '400'
                                    }}>
                                      {isEditingItem ? (
                                        <input
                                          type="text"
                                          value={editingItemValue}
                                          onChange={(e) => setEditingItemValue(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleRenameItem(item.id);
                                            if (e.key === 'Escape') {
                                              setEditingItem(null);
                                              setEditingItemValue('');
                                            }
                                          }}
                                          autoFocus
                                          style={{
                                            backgroundColor: '#0b0b0b',
                                            border: '1px solid #4caf50',
                                            borderRadius: '4px',
                                            color: '#e0e0e0',
                                            padding: '2px 8px',
                                            fontSize: '14px',
                                            outline: 'none',
                                            width: '200px'
                                          }}
                                        />
                                      ) : (
                                        item.name
                                      )}
                                      {isRented && item.rented_by && (
                                        <span style={{ color: '#888', fontSize: '12px', marginLeft: '8px' }}>
                                          👤 {item.rented_by}
                                          {item.rented_until && (
                                            <span style={{ color: '#666', fontSize: '11px', marginLeft: '4px' }}>
                                              до {new Date(item.rented_until).toLocaleDateString()}
                                            </span>
                                          )}
                                        </span>
                                      )}
                                    </span>

                                    <div style={{ display: 'flex', gap: '4px' }}>
                                      {!isEditingItem && !isMoving && (
                                        <>
                                          <button
                                            onClick={() => {
                                              setEditingItem(item.id);
                                              setEditingItemValue(item.name);
                                            }}
                                            style={{
                                              padding: '2px 8px',
                                              backgroundColor: 'transparent',
                                              border: '1px solid #555',
                                              borderRadius: '4px',
                                              color: '#888',
                                              fontSize: '12px',
                                              cursor: 'pointer',
                                              transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => {
                                              e.target.style.borderColor = '#4caf50';
                                              e.target.style.color = '#4caf50';
                                            }}
                                            onMouseLeave={(e) => {
                                              e.target.style.borderColor = '#555';
                                              e.target.style.color = '#888';
                                            }}
                                          >
                                            ✏️
                                          </button>
                                          <button
                                            onClick={() => {
                                              setMovingItem(item.id);
                                              setMovingItemTarget('');
                                            }}
                                            style={{
                                              padding: '2px 8px',
                                              backgroundColor: 'transparent',
                                              border: '1px solid #555',
                                              borderRadius: '4px',
                                              color: '#888',
                                              fontSize: '12px',
                                              cursor: 'pointer',
                                              transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={(e) => {
                                              e.target.style.borderColor = '#4caf50';
                                              e.target.style.color = '#4caf50';
                                            }}
                                            onMouseLeave={(e) => {
                                              e.target.style.borderColor = '#555';
                                              e.target.style.color = '#888';
                                            }}
                                          >
                                            ↕️
                                          </button>
                                          <button
                                            onClick={() => handleDeleteItem(item.id, item.name)}
                                            disabled={isRented}
                                            style={{
                                              padding: '2px 8px',
                                              backgroundColor: 'transparent',
                                              border: '1px solid #555',
                                              borderRadius: '4px',
                                              color: isRented ? '#444' : '#888',
                                              fontSize: '12px',
                                              cursor: isRented ? 'default' : 'pointer',
                                              transition: 'all 0.2s',
                                              opacity: isRented ? 0.3 : 1
                                            }}
                                            onMouseEnter={(e) => {
                                              if (!isRented) {
                                                e.target.style.borderColor = '#f44336';
                                                e.target.style.color = '#f44336';
                                              }
                                            }}
                                            onMouseLeave={(e) => {
                                              if (!isRented) {
                                                e.target.style.borderColor = '#555';
                                                e.target.style.color = '#888';
                                              }
                                            }}
                                          >
                                            ✕
                                          </button>
                                        </>
                                      )}

                                      {isEditingItem && (
                                        <>
                                          <button
                                            onClick={() => handleRenameItem(item.id)}
                                            style={{
                                              padding: '2px 10px',
                                              backgroundColor: '#4caf50',
                                              border: 'none',
                                              borderRadius: '4px',
                                              color: '#0b0b0b',
                                              fontSize: '12px',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            💾
                                          </button>
                                          <button
                                            onClick={() => {
                                              setEditingItem(null);
                                              setEditingItemValue('');
                                            }}
                                            style={{
                                              padding: '2px 10px',
                                              backgroundColor: '#333',
                                              border: 'none',
                                              borderRadius: '4px',
                                              color: '#aaa',
                                              fontSize: '12px',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            ✕
                                          </button>
                                        </>
                                      )}

                                      {isMoving && (
                                        <>
                                          <select
                                            value={movingItemTarget}
                                            onChange={(e) => setMovingItemTarget(e.target.value)}
                                            style={{
                                              padding: '2px 8px',
                                              backgroundColor: '#0b0b0b',
                                              border: '1px solid #333',
                                              borderRadius: '4px',
                                              color: '#e0e0e0',
                                              fontSize: '12px',
                                              outline: 'none'
                                            }}
                                            autoFocus
                                          >
                                            <option value="">Выберите подкатегорию...</option>
                                            {mainCategories
  .flatMap(main =>
    getEditorCategoryRows(main).map(sub => ({
      ...sub,
      targetLabel: `${main.name} → ${sub.editorPath}`,
    }))
  )
  .filter(sub => sub.id !== item.sub_category_id)
  .map(sub => (
    <option key={sub.id} value={sub.id}>
      {sub.targetLabel}
    </option>
  ))}

                                          </select>
                                          <button
                                            onClick={() => handleMoveItem(item.id)}
                                            style={{
                                              padding: '2px 10px',
                                              backgroundColor: '#4caf50',
                                              border: 'none',
                                              borderRadius: '4px',
                                              color: '#0b0b0b',
                                              fontSize: '12px',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            💾
                                          </button>
                                          <button
                                            onClick={() => {
                                              setMovingItem(null);
                                              setMovingItemTarget('');
                                            }}
                                            style={{
                                              padding: '2px 10px',
                                              backgroundColor: '#333',
                                              border: 'none',
                                              borderRadius: '4px',
                                              color: '#aaa',
                                              fontSize: '12px',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            ✕
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                              {/* ===== СТРОКА "ДОБАВИТЬ ПРЕДМЕТ" ===== */}
                              {showAddItem === sub.id ? (
                                <div style={{
                                  display: 'flex',
                                  gap: '8px',
                                  padding: '4px 12px',
                                  backgroundColor: '#1a1a1a',
                                  borderRadius: '4px',
                                  alignItems: 'center',
                                  borderLeft: '3px solid #4caf50'
                                }}>
                                  <input
                                    type="text"
                                    placeholder="Название предмета..."
                                    value={newItemName}
                                    onChange={(e) => setNewItemName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleAddItem(sub.id);
                                      if (e.key === 'Escape') {
                                        setShowAddItem(null);
                                        setNewItemName('');
                                      }
                                    }}
                                    autoFocus
                                    style={{
                                      flex: 1,
                                      padding: '4px 8px',
                                      backgroundColor: '#0b0b0b',
                                      border: '1px solid #4caf50',
                                      borderRadius: '4px',
                                      color: '#e0e0e0',
                                      fontSize: '14px',
                                      outline: 'none'
                                    }}
                                  />
                                  <button
                                    onClick={() => handleAddItem(sub.id)}
                                    style={{
                                      padding: '4px 12px',
                                      backgroundColor: '#4caf50',
                                      border: 'none',
                                      borderRadius: '4px',
                                      color: '#0b0b0b',
                                      fontSize: '12px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Добавить
                                  </button>
                                  <button
                                    onClick={() => {
                                      setShowAddItem(null);
                                      setNewItemName('');
                                    }}
                                    style={{
                                      padding: '4px 12px',
                                      backgroundColor: '#333',
                                      border: 'none',
                                      borderRadius: '4px',
                                      color: '#aaa',
                                      fontSize: '12px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <div
                                  onClick={() => {
                                    setShowAddItem(sub.id);
                                    setNewItemName('');
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '4px 12px',
                                    borderRadius: '4px',
                                    borderLeft: '3px solid #444',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    color: '#666',
                                    marginTop: '2px'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#1a1a1a';
                                    e.currentTarget.style.borderLeftColor = '#4caf50';
                                    e.currentTarget.style.color = '#4caf50';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.borderLeftColor = '#444';
                                    e.currentTarget.style.color = '#666';
                                  }}
                                >
                                  <span style={{ fontSize: '14px' }}>
                                    ➕ Добавить предмет
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* ===== СТРОКА "ДОБАВИТЬ ПОДКАТЕГОРИЮ" ===== */}
                    {showAddSub === mainCat.id ? (
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        padding: '6px 12px',
                        backgroundColor: '#1a1a1a',
                        borderRadius: '4px',
                        alignItems: 'center',
                        border: '1px solid #4caf50'
                      }}>
                      <label
  style={{
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    color: '#aaa',
    fontSize: 12,
    maxWidth: '100%',
  }}
>
  Где создать
  <select
    value={newSubParentId}
    onChange={event => setNewSubParentId(event.target.value)}
    disabled={addingSub}
    style={{
      padding: '7px 8px',
      background: '#111',
      color: '#eee',
      border: '1px solid #555',
      borderRadius: 4,
      maxWidth: '100%',
    }}
  >
    <option value="">
      Непосредственно в «{mainCat.name}»
    </option>

    {getEditorCategoryRows(mainCat).map(sub => (
      <option key={sub.id} value={sub.id}>
        {sub.editorPath}
      </option>
    ))}
  </select>
</label>

                        <input
                          type="text"
                          placeholder="Название подкатегории..."
                          disabled={addingSub}
                          value={newSubName}
                          onChange={(e) => setNewSubName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddSubCategory(mainCat.id);
                            if (e.key === 'Escape') {
                              setShowAddSub(null);
                              setNewSubName('');
                            }
                          }}
                          autoFocus
                          style={{
                            flex: 1,
                            padding: '4px 8px',
                            backgroundColor: '#0b0b0b',
                            border: '1px solid #4caf50',
                            borderRadius: '4px',
                            color: '#e0e0e0',
                            fontSize: '14px',
                            outline: 'none'
                          }}
                        />
                        <button
                          onClick={() => handleAddSubCategory(mainCat.id)}
                          disabled={addingSub}
                          style={{
                            padding: '4px 12px',
                            backgroundColor: '#4caf50',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#0b0b0b',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          Добавить
                        </button>
                        <button
                          onClick={() => {
                            setShowAddSub(null);
                            setNewSubName('');
                          }}
                          style={{
                            padding: '4px 12px',
                            backgroundColor: '#333',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#aaa',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          setShowAddSub(mainCat.id);
                          setNewSubName('');
                          setNewSubParentId('');

                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          border: '1px dashed #444',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          color: '#666',
                          marginTop: '4px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#1a1a1a';
                          e.currentTarget.style.borderColor = '#4caf50';
                          e.currentTarget.style.color = '#4caf50';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.borderColor = '#444';
                          e.currentTarget.style.color = '#666';
                        }}
                      >
                        <span style={{ fontSize: '14px' }}>
                          ➕ Добавить подкатегорию
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
            
          })
          
        )}
         </fieldset>
      </div>
    </div>
  );
}

export default EditorPanel;