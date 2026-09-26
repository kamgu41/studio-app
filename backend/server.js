const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const createBookingRoutes = require('./bookingRoutes');
const createAuthMiddleware = require('./authMiddleware');



dotenv.config();

const app = express();
const port = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);
// Все рабочие API-маршруты требуют подтверждённого аккаунта.
app.use('/api', createAuthMiddleware(supabase));

// Данные текущего пользователя для интерфейса.
app.get('/api/me', (req, res) => {
  res.json({
    user: req.account,
  });
});

// ============================================================
// БРОНИРОВАНИЕ V2
// ============================================================

app.use('/api/booking-v2', createBookingRoutes(supabase));

// Старые маршруты больше не должны менять учёт.
// Блок обязательно находится ПЕРЕД прежними обработчиками.
const legacyBookingDisabled = (req, res) => {
  res.status(409).json({
    error:
      'Старый способ бронирования и изменения статуса отключён. Интерфейс переводится на бронирование v2.',
  });
};

app.all('/api/equipment/bulk-book', legacyBookingDisabled);
app.all('/api/equipment/bulk-return', legacyBookingDisabled);
app.all('/api/equipment/:id/status', legacyBookingDisabled);
app.all('/api/my-bookings', legacyBookingDisabled);

// Нельзя создать предмет сразу в статусе "выдано",
// минуя бронь и операцию выдачи.
app.post('/api/equipment', (req, res, next) => {
  const status = req.body?.status;

  if (
    status !== undefined &&
    !['available', 'repair'].includes(status)
  ) {
    return res.status(400).json({
      error:
        'Новый предмет можно создать доступным или в ремонте. Выдача оформляется по брони.',
    });
  }

  next();
});


// ============================================================
// ОСНОВНЫЕ МАРШРУТЫ
// ============================================================

// GET /api/test — для совместимости со старым фронтендом
app.get('/api/test', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .order('name');

    if (error) throw error;
    res.json({ message: 'Соединение с базой работает!', data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/equipment — получить всё оборудование
app.get('/api/equipment', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/my-bookings — бронирования пользователя
app.get('/api/my-bookings', async (req, res) => {
  const { user } = req.query;
  if (!user) return res.status(400).json({ error: 'Укажите имя пользователя' });

  try {
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .eq('rented_by', user)
      .eq('status', 'rented')
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/full-hierarchy — вся иерархия одним запросом
app.get('/api/full-hierarchy', async (req, res) => {
  try {
    console.log('🟢 Запрос иерархии...');

    const { data: mainCategories, error: mainError } = await supabase
      .from('main_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (mainError) {
      console.error('❌ Ошибка главных категорий:', mainError);
      return res.status(500).json({ error: mainError.message });
    }

    if (!mainCategories || mainCategories.length === 0) {
      return res.json([]);
    }

    const { data: allSubs, error: subError } = await supabase
      .from('sub_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (subError) {
      console.error('❌ Ошибка подкатегорий:', subError);
      return res.status(500).json({ error: subError.message });
    }

    const { data: allItems, error: itemsError } = await supabase
      .from('equipment')
      .select('*')
      .order('name');

    if (itemsError) {
      console.error('❌ Ошибка оборудования:', itemsError);
      return res.status(500).json({ error: itemsError.message });
    }

    const hierarchy = mainCategories.map(main => {
      const subs = allSubs.filter(sub => sub.main_category_id === main.id);
      
      const subWithItems = subs.map(sub => ({
        ...sub,
        items: allItems.filter(item => item.sub_category_id === sub.id)
      }));

      return {
        ...main,
        subCategories: subWithItems
      };
    });

    console.log(`🟢 Иерархия построена, ${hierarchy.length} категорий`);
    res.json(hierarchy);
  } catch (err) {
    console.error('❌ Критическая ошибка:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ИЗМЕНЕНИЕ СТАТУСА (ОДИН ПРЕДМЕТ)
// ============================================================

app.patch('/api/equipment/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, rentedBy, rentedUntil, repairComment } = req.body;

  if (!['available', 'repair', 'rented'].includes(status)) {
    return res.status(400).json({ error: 'Некорректный статус' });
  }

  try {
    let updateData = { status };
    
    if (status === 'rented') {
      if (!rentedBy) return res.status(400).json({ error: 'Укажите, кто берёт оборудование' });
      updateData.rented_by = rentedBy;
      updateData.rented_until = rentedUntil || null;
      updateData.repair_comment = null;
      updateData.repaired_by = null;
    } else if (status === 'repair') {
      updateData.rented_by = null;
      updateData.rented_until = null;
      updateData.repair_comment = repairComment || 'Не указано';
      updateData.repaired_by = rentedBy;
    } else {
      updateData.rented_by = null;
      updateData.rented_until = null;
      updateData.repair_comment = null;
      updateData.repaired_by = null;
    }

    const { data, error } = await supabase
      .from('equipment')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// МАССОВЫЕ ОПЕРАЦИИ
// ============================================================

// POST /api/equipment/bulk-book — массовое бронирование
app.post('/api/equipment/bulk-book', async (req, res) => {
  const { ids, rentedBy, rentedUntil, comment } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Передайте массив ID оборудования' });
  }

  if (!rentedBy) {
    return res.status(400).json({ error: 'Укажите, кто берёт оборудование' });
  }

  try {
    const { data, error } = await supabase
      .from('equipment')
      .update({
        status: 'rented',
        rented_by: rentedBy,
        rented_until: rentedUntil || null,
        repair_comment: null,
        repaired_by: null,
        booking_comment: comment || null
      })
      .in('id', ids)
      .select();

    if (error) throw error;

    const bookings = ids.map(id => ({
      equipment_id: id,
      start_date: new Date().toISOString().split('T')[0],
      end_date: rentedUntil || null,
      comment: comment || null,
      status: 'active'
    }));

    const { error: bookError } = await supabase
      .from('bookings')
      .insert(bookings);

    if (bookError) throw bookError;

    res.json({ success: true, data });
  } catch (err) {
    console.error('❌ Ошибка бронирования:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/equipment/bulk-return — массовый возврат
app.post('/api/equipment/bulk-return', async (req, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Передайте массив ID оборудования' });
  }

  try {
    const { data, error } = await supabase
      .from('equipment')
      .update({
        status: 'available',
        rented_by: null,
        rented_until: null,
        repair_comment: null,
        repaired_by: null,
        booking_comment: null
      })
      .in('id', ids)
      .select();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    console.error('❌ Ошибка массового возврата:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// МАРШРУТЫ ДЛЯ РЕДАКТОРА
// ============================================================

// POST /api/equipment — добавление нового предмета (с возвратом ID)
app.post('/api/equipment', async (req, res) => {
  const { name, description, status, sub_category_id } = req.body;

  if (!name || !description) {
    return res.status(400).json({ error: 'Укажите название и категорию' });
  }

  try {
    const insertData = {
      name: name.trim(),
      description: description.trim(),
      status: status || 'available'
    };

    if (sub_category_id) {
      insertData.sub_category_id = sub_category_id;
    }

    const { data, error } = await supabase
      .from('equipment')
      .insert([insertData])
      .select(); // ← обязательно .select(), чтобы вернуть созданный предмет

    if (error) throw error;
    res.status(201).json(data[0]); // ← возвращаем первый созданный предмет
  } catch (err) {
    console.error('❌ Ошибка добавления предмета:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sub-category — добавить подкатегорию
app.post('/api/sub-category', async (req, res) => {
  const { name, main_category_id } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: 'Укажите название подкатегории' });
  }
  if (!main_category_id) {
    return res.status(400).json({ error: 'Укажите главную категорию' });
  }

  try {
    const { data, error } = await supabase
      .from('sub_categories')
      .insert({ name: name.trim(), main_category_id })
      .select();

    if (error) throw error;
    res.status(201).json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/sub-category/:id — переименовать подкатегорию
app.patch('/api/sub-category/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: 'Укажите новое название' });
  }

  try {
    const { data, error } = await supabase
      .from('sub_categories')
      .update({ name: name.trim() })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/sub-category/:id — удалить подкатегорию (только если пустая)
app.delete('/api/sub-category/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { count, error: countError } = await supabase
      .from('equipment')
      .select('*', { count: 'exact', head: true })
      .eq('sub_category_id', id);

    if (countError) throw countError;

    if (count > 0) {
      return res.status(400).json({ 
        error: 'Нельзя удалить непустую подкатегорию. Сначала переместите или удалите предметы.' 
      });
    }

    const { error } = await supabase
      .from('sub_categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/equipment/:id/move-sub — переместить предмет в другую подкатегорию
app.patch('/api/equipment/:id/move-sub', async (req, res) => {
  const { id } = req.params;
  const { newSubCategoryId } = req.body;

  if (!newSubCategoryId) {
    return res.status(400).json({ error: 'Укажите новую подкатегорию' });
  }

  try {
    const { data: item, error: findError } = await supabase
      .from('equipment')
      .select('status')
      .eq('id', id)
      .single();

    if (findError) throw findError;
    if (item.status === 'rented') {
      return res.status(400).json({ 
        error: 'Нельзя переместить занятый предмет. Сначала освободите его.' 
      });
    }

    const { data, error } = await supabase
      .from('equipment')
      .update({ sub_category_id: newSubCategoryId })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (err) {
    console.error('❌ Ошибка перемещения:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/equipment/:id/rename — переименовать предмет
app.patch('/api/equipment/:id/rename', async (req, res) => {
  const { id } = req.params;
  const { newName } = req.body;

  if (!newName?.trim()) {
    return res.status(400).json({ error: 'Укажите новое название' });
  }

  try {
    const { data, error } = await supabase
      .from('equipment')
      .update({ name: newName.trim() })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json({ success: true, data: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/equipment/:id — удалить предмет
app.delete('/api/equipment/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { data: item, error: findError } = await supabase
      .from('equipment')
      .select('status')
      .eq('id', id)
      .single();

    if (findError) throw findError;
    if (item.status === 'rented') {
      return res.status(400).json({ 
        error: 'Нельзя удалить занятый предмет. Сначала освободите его.' 
      });
    }

    const { error } = await supabase
      .from('equipment')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ЗАПУСК
// ============================================================

app.get('/', (req, res) => res.send('Сервер работает!'));

app.listen(port, '127.0.0.1', () => {
  console.log(`Сервер запущен на http://127.0.0.1:${port}`);
  console.log('Бронирование v2 подключено. Старые операции отключены.');
});
