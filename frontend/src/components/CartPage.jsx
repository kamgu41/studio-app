import { useRef, useState } from 'react';
import axios from '../api';
import {
  displayDate,
  mutationError,
  ui,
  useBookingData,
} from './bookingUi';

function moveMonth(month, offset) {
  // Это только арифметика месяцев в UTC, не перевод выбранной даты.
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

function getMonthDays(month) {
  const [year, number] = month.split('-').map(Number);
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();

  return Array.from(
    { length: count },
    (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`
  );
}

export default function CartPage({
  cart,
  setCart,
  onClose,
  onBookingComplete,
  currentUser,
}) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visibleMonth, setVisibleMonth] = useState('');
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const submitLock = useRef(false);

  const idsKey = cart.map(item => item.id).sort().join(',');
  const user = typeof currentUser === 'string' ? currentUser.trim() : '';

  const url = idsKey
    ? `/api/booking-v2/availability?ids=${encodeURIComponent(idsKey)}`
    : null;

  const { data, error, loading, reload } = useBookingData(url);

  const today = data?.today || '';
  const bookings = data?.bookings || [];
  const equipment = data?.equipment || [];
  const ready =
    Boolean(data) &&
    Array.isArray(data.equipment) &&
    data.equipment.length === cart.length;

  const month = visibleMonth || today.slice(0, 7);
  const days = month ? getMonthDays(month) : [];

  const offset = month
    ? (new Date(`${month}-01T12:00:00Z`).getUTCDay() + 6) % 7
    : 0;

  const monthTitle = month
    ? new Date(`${month}-01T12:00:00Z`).toLocaleDateString('ru-RU', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : '';

  // Запрет на все даты: ремонт, просроченная или несвязанная выдача.
  const blockedItems = equipment.filter(item => {
    if (item.status === 'repair') return true;
    if (item.status !== 'rented') return false;

    const hasIssuedBooking = bookings.some(
      booking =>
        booking.equipment_id === item.id &&
        booking.status === 'issued'
    );

    return (
      !item.rented_until ||
      item.rented_until < today ||
      !hasIssuedBooking
    );
  });

  const conflicts = startDate && endDate
    ? bookings.filter(
        booking =>
          booking.start_date <= endDate &&
          startDate <= booking.end_date
      )
    : [];

  let problem = '';

  if (!user) {
    problem = 'Сначала укажите пользователя.';
  } else if (blockedItems.length) {
    problem =
      'Недоступны для нового бронирования: ' +
      blockedItems.map(item => item.name).join(', ') +
      '. Уберите их из корзины или сначала оформите возврат/ремонт.';
  } else if (startDate && startDate < today) {
    problem = 'Начало не может быть раньше сегодняшней даты на Камчатке.';
  } else if (startDate && endDate && endDate < startDate) {
    problem = 'Окончание не может быть раньше начала.';
  } else if (conflicts.length) {
    const names = [...new Set(conflicts.map(booking =>
      equipment.find(item => item.id === booking.equipment_id)?.name ||
      'Неизвестный предмет'
    ))];

    problem = 'В выбранном периоде заняты: ' + names.join(', ');
  }

  const canSubmit =
    ready &&
    !loading &&
    !error &&
    !sending &&
    Boolean(startDate && endDate) &&
    !problem;

  function isBusy(date) {
    return blockedItems.length > 0 || bookings.some(
      booking =>
        booking.start_date <= date &&
        date <= booking.end_date
    );
  }

  function chooseDate(date) {
    if (sending || !ready || date < today || isBusy(date)) return;

    setMessage('');

    if (!startDate || endDate || date < startDate) {
      setStartDate(date);
      setEndDate('');
    } else {
      setEndDate(date);
    }
  }

  async function confirmBooking() {
    if (!canSubmit || submitLock.current) return;

    submitLock.current = true;
    setSending(true);
    setMessage('');

    const quantity = cart.length;

    try {
      await axios.post('/api/booking-v2/reserve', {
        ids: cart.map(item => item.id),
        startDate,
        endDate,
        comment: comment.trim() || null,
      });
    } catch (err) {
      setMessage(mutationError(err));
      reload();
      return;
    } finally {
      submitLock.current = false;
      setSending(false);
    }

    // Ошибка обновления родителя не должна считаться ошибкой бронирования.
    setCart([]);

    window.alert(
      `Бронь создана: ${quantity} позиций.\n` +
      `${displayDate(startDate)} — ${displayDate(endDate)}.\n` +
      'Оборудование ещё не выдано.'
    );

    try {
      await onBookingComplete?.();
    } catch (err) {
      console.error('Бронь сохранена, но список не обновился:', err);
      window.alert('Бронь сохранена. Обновите страницу для обновления списка.');
    }
  }

  if (!cart.length) {
    return (
      <div style={ui.page}>
        <h2>Корзина пуста</h2>
        <button type="button" style={ui.button} onClick={onClose}>
          Вернуться к списку
        </button>
      </div>
    );
  }

  return (
    <div style={ui.page}>
      <div style={ui.row}>
        <div>
          <h2>Корзина: {cart.length}</h2>
          <p style={ui.muted}>Бронирует: {user || 'не выбран'}</p>
        </div>

        <button
          type="button"
          style={ui.button}
          disabled={sending}
          onClick={onClose}
        >
          Закрыть
        </button>
      </div>

      <div style={ui.panel}>
        {cart.map(item => (
          <div
            key={item.id}
            style={{ ...ui.row, padding: '8px 0' }}
          >
            <span>{item.name}</span>
            <button
              type="button"
              style={ui.button}
              disabled={sending}
              onClick={() => {
                setMessage('');
                setCart(previous =>
                  previous.filter(entry => entry.id !== item.id)
                );
              }}
            >
              Удалить
            </button>
          </div>
        ))}
      </div>

      <div style={ui.panel}>
        <div style={ui.row}>
          <h3>Даты бронирования</h3>
          <button
            type="button"
            style={ui.button}
            disabled={loading || sending}
            onClick={reload}
          >
            Обновить занятость
          </button>
        </div>

        <p style={ui.muted}>
          Камчатка · обе даты включительно
          {today ? ` · сегодня ${displayDate(today)}` : ''}
        </p>

        {loading && <p>Загрузка занятых дат…</p>}
        {error && <p role="alert" style={ui.error}>{error}</p>}

        {data && !ready && (
          <p role="alert" style={ui.error}>
            Получен неполный список оборудования. Бронирование заблокировано.
          </p>
        )}

        {ready && (
          <>
            <div style={ui.row}>
              <button
                type="button"
                style={ui.button}
                disabled={sending}
                onClick={() => setVisibleMonth(moveMonth(month, -1))}
                aria-label="Предыдущий месяц"
              >
                ←
              </button>

              <strong>{monthTitle}</strong>

              <button
                type="button"
                style={ui.button}
                disabled={sending}
                onClick={() => setVisibleMonth(moveMonth(month, 1))}
                aria-label="Следующий месяц"
              >
                →
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              gap: 4,
              marginTop: 16,
            }}>
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                <div
                  key={day}
                  style={{ ...ui.muted, textAlign: 'center', padding: 6 }}
                >
                  {day}
                </div>
              ))}

              {Array.from({ length: offset }, (_, index) => (
                <div key={`space-${index}`} />
              ))}

              {days.map(date => {
                const busy = isBusy(date);
                const past = date < today;
                const selected =
                  date === startDate ||
                  Boolean(
                    startDate && endDate &&
                    startDate <= date && date <= endDate
                  );

                return (
                  <button
                    type="button"
                    key={date}
                    disabled={sending || busy || past}
                    onClick={() => chooseDate(date)}
                    title={busy ? 'Хотя бы один предмет недоступен' : date}
                    style={{
                      ...ui.button,
                      padding: '12px 0',
                      opacity: past ? 0.35 : 1,
                      background: busy
                        ? '#792727'
                        : selected ? '#2f7d44' : '#202020',
                      border: date === today
                        ? '2px solid #74c98c'
                        : '1px solid #333',
                    }}
                  >
                    {Number(date.slice(-2))}
                  </button>
                );
              })}
            </div>

            <p style={ui.muted}>
              Красный — есть занятый предмет. Зелёный — выбранный период.
              Нажмите начало, затем окончание. Для одного дня нажмите его дважды.
            </p>

            <div style={ui.row}>
              <label style={{ flex: '1 1 200px' }}>
                Начало
                <input
                  type="date"
                  style={ui.input}
                  min={today}
                  value={startDate}
                  disabled={sending}
                  onChange={event => {
                    setStartDate(event.target.value);
                    setMessage('');
                  }}
                />
              </label>

              <label style={{ flex: '1 1 200px' }}>
                Окончание
                <input
                  type="date"
                  style={ui.input}
                  min={startDate || today}
                  value={endDate}
                  disabled={sending}
                  onChange={event => {
                    setEndDate(event.target.value);
                    setMessage('');
                  }}
                />
              </label>
            </div>
          </>
        )}
      </div>

      <label>
        Комментарий
        <textarea
          rows={3}
          maxLength={2000}
          style={{ ...ui.input, marginTop: 6 }}
          value={comment}
          disabled={sending}
          onChange={event => setComment(event.target.value)}
          placeholder="Например: съёмка интервью, комплект для выезда"
        />
      </label>

      {problem && <p role="alert" style={ui.error}>{problem}</p>}
      {message && <p role="alert" style={ui.error}>{message}</p>}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={confirmBooking}
        style={{
          ...ui.button,
          width: '100%',
          marginTop: 16,
          background: canSubmit ? '#2f7d44' : '#252525',
          opacity: canSubmit ? 1 : 0.6,
        }}
      >
        {sending ? 'Оформление…' : 'Забронировать всё'}
      </button>

      <p style={ui.muted}>
        Бронь резервирует даты. Выдача оформляется отдельно в «Моих бронированиях».
      </p>
    </div>
  );
}
