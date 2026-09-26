const express = require('express');

const TIME_ZONE = 'Asia/Kamchatka';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function httpError(status, message) {
  const error = new Error(message);
  error.httpStatus = status;
  return error;
}

function getToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}



function readIds(value) {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > 150 ||
    value.some(id => typeof id !== 'string' || !UUID_PATTERN.test(id))
  ) {
    throw httpError(400, 'Передайте от 1 до 150 корректных ID оборудования');
  }

  const ids = value.map(id => id.toLowerCase());

  if (new Set(ids).size !== ids.length) {
    throw httpError(400, 'В списке повторяются предметы');
  }

  return ids;
}

function readDate(value, label) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith('0000-')
  ) {
    throw httpError(400, `${label}: нужна дата в формате YYYY-MM-DD`);
  }

  // Только проверяем календарную дату.
  // Выбранный день не переводим из местного времени в UTC.
  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw httpError(400, `${label}: несуществующая дата`);
  }

  return value;
}

// Не выдаём неполный список за полный, если достигнут лимит API.
async function readCompleteList(query) {
  const { data, error, count } = await query;

  if (error) throw error;

  if (!Array.isArray(data) || count !== data.length) {
    throw httpError(
      503,
      'Не удалось получить полный список. Нужна проверка лимита выборки.'
    );
  }

  return data;
}

module.exports = function createBookingRoutes(supabase) {
  const router = express.Router();
  router.use((req, res, next) => {
  if (!req.account?.id) {
    return res.status(401).json({
      error: 'Необходимо войти в аккаунт',
    });
  }

  next();
});


  // Обработка ошибок работает и без Express 5.
  function handle(handler) {
    return async (req, res) => {
      try {
        await handler(req, res);
      } catch (error) {
        if (error.httpStatus) {
          return res.status(error.httpStatus).json({
            error: error.message,
          });
        }

        // Понятные сообщения, которые возвращают наши SQL-функции.
        if (error.code === '42501') {
  return res.status(403).json({
    error: 'Нет доступа к этой операции или бронированию',
  });
}

        if (error.code === 'P0001') {
          return res.status(409).json({
            error: error.message,
          });
        }

        if (error.code === '23P01' || error.code === '23505') {
          return res.status(409).json({
            error:
              'Конфликт бронирования или выдачи. Обновите список и проверьте даты.',
          });
        }

        if (
          error.code === '22P02' ||
          error.code === '22007' ||
          error.code === '22008'
        ) {
          return res.status(400).json({
            error: 'Некорректный идентификатор или дата',
          });
        }

        console.error('Ошибка API бронирований:', error);

        return res.status(500).json({
          error:
            'Ошибка сервера бронирований. Подробности — в терминале бэкенда.',
        });
      }
    };
  }

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  // Служебная информация для интерфейса.
  router.get('/meta', (req, res) => {
    res.json({
      version: 2,
      timeZone: TIME_ZONE,
      today: getToday(),
      datesInclusive: true,
    });
  });

  // Занятые периоды для выбранных предметов.
  //
  // GET /api/booking-v2/availability?ids=uuid1,uuid2
  //
  // Сведения о владельцах и комментарии сюда не включаем.
  router.get('/availability', handle(async (req, res) => {
    if (typeof req.query.ids !== 'string') {
      throw httpError(400, 'Укажите ID оборудования');
    }

    const ids = readIds(req.query.ids.split(','));

    const equipment = await readCompleteList(
      supabase
        .from('equipment')
        .select(
          'id, name, status, rented_until',
          { count: 'exact' }
        )
        .in('id', ids)
        .order('id')
    );

    if (equipment.length !== ids.length) {
      throw httpError(404, 'Часть оборудования не найдена');
    }

    const bookings = await readCompleteList(
      supabase
        .from('bookings')
        .select(
          'id, equipment_id, start_date, end_date, status',
          { count: 'exact' }
        )
        .in('equipment_id', ids)
        .in('status', ['reserved', 'issued'])
        .order('start_date')
        .order('id')
    );

    res.json({
      today: getToday(),
      timeZone: TIME_ZONE,
      equipment,
      bookings,
    });
  }));

// GET /api/booking-v2/mine
// Владельца определяет сервер по токену.

  router.get('/mine', handle(async (req, res) => {

    const bookings = await readCompleteList(
      supabase
        .from('bookings')
        .select(`
          id,
          equipment_id,
          booked_by,
          batch_id,
          start_date,
          end_date,
          status,
          comment,
          issued_at,
          created_at,
          equipment:equipment_id (
            id,
            name,
            description,
            status,
            rented_until
          )
        `, { count: 'exact' })
        .eq('user_id', req.account.id)
        .in('status', ['reserved', 'issued'])
        .order('start_date')
        .order('id')
    );

    res.json({
      today: getToday(),
      timeZone: TIME_ZONE,
      bookings,
    });
  }));

  // Бронирование всей корзины.
  //
  // POST /api/booking-v2/reserve
  // { ids, user, startDate, endDate, comment }
  router.post('/reserve', handle(async (req, res) => {
    const body = req.body || {};

    const ids = readIds(body.ids);
    const startDate = readDate(body.startDate, 'Начало');
    const endDate = readDate(body.endDate, 'Окончание');

    if (startDate > endDate) {
      throw httpError(400, 'Окончание не может быть раньше начала');
    }

    let comment = null;

    if (body.comment !== undefined && body.comment !== null) {
      if (
        typeof body.comment !== 'string' ||
        body.comment.length > 2000
      ) {
        throw httpError(400, 'Комментарий должен быть строкой до 2000 символов');
      }

      comment = body.comment.trim() || null;
    }

    // Проверку "не раньше сегодня" окончательно выполняет БАЗА.
    // Там же проверяются ремонт, пересечения и вся корзина.
    const { data, error } = await supabase.rpc('studio_book', {
      p_ids: ids,
      p_user_id: req.account.id,
      p_start: startDate,
      p_end: endDate,
      p_comment: comment,
    });

    if (error) throw error;

    res.status(201).json({
      success: true,
      ...data,
    });
  }));

  // Действие по ID БРОНИ, а не ID оборудования.
  //
  // POST /api/booking-v2/:id/action
  // { user, action: "issue" | "return" | "cancel" }
  router.post('/:id/action', handle(async (req, res) => {
    const body = req.body || {};

    if (!UUID_PATTERN.test(req.params.id)) {
      throw httpError(400, 'Некорректный ID брони');
    }


    if (!['issue', 'return', 'cancel'].includes(body.action)) {
      throw httpError(400, 'Неизвестное действие');
    }

    const { data, error } = await supabase.rpc(
      'studio_booking_action',
      {
        p_booking_id: req.params.id,
        p_user_id: req.account.id,
        p_action: body.action,
      }
    );

    if (error) throw error;

    res.json({
      success: true,
      booking: data,
    });
  }));
  // Начало и завершение ремонта.
  // POST /api/booking-v2/equipment/:id/repair
  router.post('/equipment/:id/repair', handle(async (req, res) => {
    const body = req.body || {};

    if (!UUID_PATTERN.test(req.params.id)) {
      throw httpError(400, 'Некорректный ID оборудования');
    }


    if (!['start', 'finish'].includes(body.action)) {
      throw httpError(400, 'Неизвестное действие с ремонтом');
    }

    if (
      body.comment != null &&
      (
        typeof body.comment !== 'string' ||
        body.comment.length > 2000
      )
    ) {
      throw httpError(400, 'Комментарий должен быть строкой до 2000 символов');
    }

    const { data, error } = await supabase.rpc('studio_repair_action', {
      p_equipment_id: req.params.id,
      p_user_id: req.account.id,
      p_action: body.action,
      p_comment: body.comment?.trim() || null,
    });

    if (error) throw error;

    res.json({
      success: true,
      equipment: data,
    });
  }));

  return router;
};
