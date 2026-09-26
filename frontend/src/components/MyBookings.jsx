import { useRef, useState } from 'react';
import axios from '../api';
import {
  displayDate,
  mutationError,
  ui,
  useBookingData,
} from './bookingUi';

export default function MyBookings({
  currentUser,
  onClose,
  onBookingsChanged,
}) {
  const user = typeof currentUser === 'string' ? currentUser.trim() : '';
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const actionLock = useRef(false);

  const url = '/api/booking-v2/mine';


  const { data, error, loading, reload } = useBookingData(url);

  const today = data?.today || '';
  const bookings = data?.bookings || [];

  async function runAction(booking, action) {
    if (actionLock.current) return;

    const name = booking.equipment?.name || 'Оборудование';
    const question = {
      issue: `Выдать «${name}»?`,
      return: `Подтверждаете фактический возврат «${name}»?`,
      cancel: `Отменить бронь «${name}»?`,
    }[action];

    if (!window.confirm(question)) return;

    actionLock.current = true;
    setBusyId(booking.id);
    setMessage('');

    try {
      await axios.post(`/api/booking-v2/${booking.id}/action`, {
        action,
      });
    } catch (err) {
      setMessage(mutationError(err));
      reload();
      return;
    } finally {
      actionLock.current = false;
      setBusyId('');
    }

    setMessage({
      issue: 'Выдача оформлена.',
      return: 'Возврат оформлен. Другие будущие брони сохранены.',
      cancel: 'Бронь отменена.',
    }[action]);

    reload();

    // Обновляем главный список отдельно от результата самой операции.
    try {
      await onBookingsChanged?.();
    } catch (err) {
      console.error('Операция сохранена, но главный список не обновился:', err);
      setMessage('Операция сохранена. Обновите главный список оборудования.');
    }
  }

  function renderBooking(booking) {
    const item = booking.equipment;
    const issued = booking.status === 'issued';
    const future = today < booking.start_date;
    const expired = booking.end_date < today;

    const canIssue =
      !issued &&
      !future &&
      !expired &&
      item?.status === 'available';

    let explanation = '';

    if (issued && expired) {
      explanation = 'Просроченная выдача. Нужен фактический возврат.';
    } else if (!issued && expired) {
      explanation = 'Срок брони прошёл без выдачи. Её можно отменить.';
    } else if (!issued && future) {
      explanation = `Выдача доступна с ${displayDate(booking.start_date)}.`;
    } else if (!issued && item?.status === 'repair') {
      explanation = 'Предмет в ремонте. Выдача заблокирована.';
    } else if (!issued && item?.status === 'rented') {
      explanation = 'Предмет ещё не возвращён по другой выдаче.';
    }

    return (
      <article key={booking.id} style={ui.panel}>
        <div style={ui.row}>
          <strong>{item?.name || 'Оборудование недоступно'}</strong>
          <span style={{ color: issued ? '#f6c76d' : '#8bd89f' }}>
            {issued ? 'Выдано' : 'Забронировано'}
          </span>
        </div>

        <p>
          {displayDate(booking.start_date)} — {displayDate(booking.end_date)}
        </p>

        {booking.comment && (
          <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {booking.comment}
          </p>
        )}

        {explanation && <p style={ui.muted}>{explanation}</p>}

        <div style={ui.row}>
          {issued ? (
            <button
              type="button"
              style={ui.button}
              disabled={Boolean(busyId)}
              onClick={() => runAction(booking, 'return')}
            >
              {busyId === booking.id ? 'Выполнение…' : 'Оформить возврат'}
            </button>
          ) : (
            <>
              <button
                type="button"
                style={{
                  ...ui.button,
                  opacity: canIssue ? 1 : 0.45,
                }}
                disabled={Boolean(busyId) || !canIssue}
                onClick={() => runAction(booking, 'issue')}
              >
                {busyId === booking.id ? 'Выполнение…' : 'Выдать'}
              </button>

              <button
                type="button"
                style={ui.button}
                disabled={Boolean(busyId)}
                onClick={() => runAction(booking, 'cancel')}
              >
                Отменить бронь
              </button>
            </>
          )}
        </div>
      </article>
    );
  }

  const issuedBookings = bookings.filter(item => item.status === 'issued');
  const reservedBookings = bookings.filter(item => item.status === 'reserved');

  return (
    <div style={ui.page}>
      <div style={ui.row}>
        <h2>Мои бронирования</h2>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            style={ui.button}
            disabled={!user || loading || Boolean(busyId)}
            onClick={reload}
          >
            Обновить
          </button>

          {onClose && (
            <button
              type="button"
              style={ui.button}
              disabled={Boolean(busyId)}
              onClick={onClose}
            >
              Закрыть
            </button>
          )}
        </div>
      </div>

      <p style={ui.muted}>
        Пользователь: {user || 'не выбран'}
        {today ? ` · Камчатка, ${displayDate(today)}` : ''}
      </p>

      {!user && <p style={ui.error}>Сначала выберите пользователя.</p>}
      {loading && <p>Загрузка бронирований…</p>}
      {error && <p role="alert" style={ui.error}>{error}</p>}
      {message && <p role="status">{message}</p>}

      {data && bookings.length === 0 && (
        <div style={ui.panel}>
          Незавершённых бронирований и выдач нет.
        </div>
      )}

      {issuedBookings.length > 0 && (
        <section>
          <h3>На руках — {issuedBookings.length}</h3>
          {issuedBookings.map(renderBooking)}
        </section>
      )}

      {reservedBookings.length > 0 && (
        <section>
          <h3>Забронировано — {reservedBookings.length}</h3>
          {reservedBookings.map(renderBooking)}
        </section>
      )}
    </div>
  );
}
