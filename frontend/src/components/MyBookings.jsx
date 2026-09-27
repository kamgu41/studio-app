import { useRef, useState } from 'react';
import api from '../api';
import {
  displayDate,
  mutationError,
  ui,
  useBookingData,
} from './bookingUi';

const STATUS_LABELS = {
  reserved: 'Ожидает выдачи',
  issued: 'На руках',
  completed: 'Возвращено',
  returned: 'Возвращено',
  cancelled: 'Отменено',
  canceled: 'Отменено',
};

const STATUS_COLORS = {
  reserved: {
    text: '#f6c76d',
    background: '#302719',
    border: '#8a6933',
  },
  issued: {
    text: '#9de2ae',
    background: '#192e21',
    border: '#438657',
  },
  closed: {
    text: '#b5b5b5',
    background: '#242424',
    border: '#454545',
  },
};

function getStatusColors(status) {
  return STATUS_COLORS[status] || STATUS_COLORS.closed;
}


const buttonsStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
};

function itemName(booking) {
  return booking.equipment?.name || 'Оборудование недоступно';
}

function issueProblem(booking, today) {
  if (booking.status !== 'reserved') return 'Это не активная бронь.';
  if (!today) return 'Не удалось определить текущую дату.';
  if (today < booking.start_date) {
    return `Можно взять с ${displayDate(booking.start_date)}.`;
  }
  if (today > booking.end_date) {
    return 'Срок брони прошёл. Можно отменить бронь.';
  }
  if (!booking.equipment) return 'Оборудование не найдено.';
  if (booking.equipment.status === 'repair') {
    return 'Предмет в ремонте.';
  }
  if (booking.equipment.status === 'rented') {
    return 'Предмет ещё не возвращён по другой выдаче.';
  }
  if (booking.equipment.status !== 'available') {
    return 'Состояние предмета не допускает выдачу.';
  }
  return '';
}

function BookingGroup({ bookings, today, busy, onAction }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmation, setConfirmation] = useState(null);

  const first = bookings[0];
  const reserved = bookings.filter(item => item.status === 'reserved');
  const issued = bookings.filter(item => item.status === 'issued');
  const returned = bookings.filter(
  item => ['completed', 'returned'].includes(item.status)
);


  const otherClosed = bookings.length -
    reserved.length - issued.length - returned.length;

  const availableToIssue = reserved.filter(
    item => !issueProblem(item, today)
  );

  const selected = bookings.filter(
    item => selectedIds.includes(item.id)
  );

  const canIssueSelection = selected.length > 0 &&
    selected.every(item => !issueProblem(item, today));

  const canReturnSelection = selected.length > 0 &&
    selected.every(item => item.status === 'issued');

  const canIssueAll = reserved.length > 0 &&
    availableToIssue.length === reserved.length;

  const start = bookings
    .map(item => item.start_date)
    .sort()[0];

  const end = bookings
    .map(item => item.end_date)
    .sort()
    .at(-1);

  function toggle(id) {
    setSelectedIds(previous =>
      previous.includes(id)
        ? previous.filter(value => value !== id)
        : [...previous, id]
    );
  }

  function ask(action, items) {
    if (busy || items.length === 0) return;
    setConfirmation({ action, items });
  }

  async function confirmAction() {
    if (!confirmation || busy) return;

    const operation = confirmation;
    setConfirmation(null);
    setSelectedIds([]);

    await onAction(operation.items, operation.action);
  }

  const actionTitle = {
    issue: 'Подтвердить получение',
    return: 'Подтвердить фактический возврат',
    cancel: 'Отменить бронь',
  };

  return (
    <article style={ui.panel}>
      <div style={ui.row}>
        <h3 style={{ margin: 0 }}>
          Комплект · {bookings.length} поз.
        </h3>

        <span style={ui.muted}>
          № {(first.batch_id || first.id).slice(0, 8)}
        </span>
      </div>

      <p>
        {displayDate(start)} — {displayDate(end)}
      </p>

      {first.comment && (
        <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
          {first.comment}
        </p>
      )}

      <div
  style={{
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    margin: '14px 0',
  }}
>
  {[
    {
      label: 'Ожидает выдачи',
      count: reserved.length,
      colors: STATUS_COLORS.reserved,
    },
    {
      label: 'На руках',
      count: issued.length,
      colors: STATUS_COLORS.issued,
    },
    {
      label: 'Возвращено',
      count: returned.length,
      colors: STATUS_COLORS.closed,
    },
    {
      label: 'Прочие завершённые',
      count: otherClosed,
      colors: STATUS_COLORS.closed,
    },
  ]
    .filter(item => item.count > 0)
    .map(item => (
      <span
        key={item.label}
        style={{
          padding: '6px 10px',
          borderRadius: 6,
          border: `1px solid ${item.colors.border}`,
          background: item.colors.background,
          color: item.colors.text,
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {item.label}: {item.count}
      </span>
    ))}
</div>


      {confirmation && (
        <section
          aria-label="Подтверждение операции"
          style={{
            ...ui.panel,
            borderColor: '#779b7c',
            background: '#172219',
          }}
        >
          <h4 style={{ marginTop: 0 }}>
            {actionTitle[confirmation.action]}
            {' — '}{confirmation.items.length} поз.?
          </h4>

          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            <ul>
              {confirmation.items.map(item => (
                <li key={item.id}>{itemName(item)}</li>
              ))}
            </ul>
          </div>

          {confirmation.action === 'return' && (
            <p>Подтверждайте только то, что действительно вернули.</p>
          )}

          <div style={buttonsStyle}>
            <button
              type="button"
              style={ui.button}
              disabled={busy}
              onClick={confirmAction}
            >
              Подтвердить
            </button>

            <button
              type="button"
              style={ui.button}
              disabled={busy}
              onClick={() => setConfirmation(null)}
            >
              Не выполнять
            </button>
          </div>
        </section>
      )}

      <fieldset
        disabled={busy || Boolean(confirmation)}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
        <div style={buttonsStyle}>
          {reserved.length > 0 && (
            <button
              type="button"
              style={{
                ...ui.button,
                opacity: canIssueAll ? 1 : 0.45,
              }}
              disabled={!canIssueAll}
              onClick={() => ask('issue', reserved)}
            >
              Взять всё — {reserved.length}
            </button>
          )}

          {issued.length > 0 && (
            <button
              type="button"
              style={ui.button}
              onClick={() => ask('return', issued)}
            >
              Вернуть всё — {issued.length}
            </button>
          )}
        </div>

        {reserved.length > 0 && !canIssueAll && (
          <p style={ui.muted}>
            Весь оставшийся комплект сейчас выдать нельзя.
            Причины указаны у предметов. Можно выбрать доступную часть.
          </p>
        )}

        <details open style={{ marginTop: 16 }}>
          <summary style={{ cursor: 'pointer', padding: '8px 0' }}>
            Состав комплекта и выбор предметов
          </summary>

          <div style={{ ...buttonsStyle, margin: '12px 0' }}>
            <button
              type="button"
              style={ui.button}
              disabled={availableToIssue.length === 0}
              onClick={() => setSelectedIds(
                availableToIssue.map(item => item.id)
              )}
            >
              Выбрать доступные к выдаче
            </button>

            <button
              type="button"
              style={ui.button}
              disabled={issued.length === 0}
              onClick={() => setSelectedIds(
                issued.map(item => item.id)
              )}
            >
              Выбрать всё на руках
            </button>

            <button
              type="button"
              style={ui.button}
              disabled={selected.length === 0}
              onClick={() => setSelectedIds([])}
            >
              Снять выбор
            </button>
          </div>

          {bookings.map(booking => {
            const problem = booking.status === 'reserved'
              ? issueProblem(booking, today)
              : '';

            const selectable = booking.status === 'issued' ||
              (booking.status === 'reserved' && !problem);

            const overdue = booking.status === 'issued' &&
              today > booking.end_date;
            const statusColors = getStatusColors(booking.status);

            return (
              <div
  key={booking.id}
  style={{
    padding: '12px 14px',
    marginTop: 10,
    border: '1px solid #333',
    borderLeft: `4px solid ${statusColors.border}`,
    borderRadius: 8,
    background: '#181818',
  }}
>

                <div style={ui.row}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      flex: '1 1 220px',
                      minWidth: 0,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(booking.id)}
                      disabled={!selectable}
                      onChange={() => toggle(booking.id)}
                      style={{
                        width: 20,
                        height: 20,
                        flexShrink: 0,
                        margin: 0,
                      }}
                    />

                    <strong style={{ overflowWrap: 'anywhere' }}>
                      {itemName(booking)}
                    </strong>
                  </label>

                  <span
  style={{
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 10px',
    borderRadius: 6,
    border: `1px solid ${statusColors.border}`,
    background: statusColors.background,
    color: statusColors.text,
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  }}
>
  {STATUS_LABELS[booking.status] ||
    `Статус: ${booking.status}`}
</span>

                </div>

                {problem && <p style={ui.muted}>{problem}</p>}

                {overdue && (
                  <p style={{ color: '#f6c76d' }}>
                    Срок возврата прошёл.
                  </p>
                )}

                <div style={{ ...buttonsStyle, marginTop: 8 }}>
                  {booking.status === 'reserved' && (
                    <>
                      <button
                        type="button"
                        style={ui.button}
                        disabled={Boolean(problem)}
                        onClick={() => ask('issue', [booking])}
                      >
                        Взять
                      </button>

                      <button
                        type="button"
                        style={ui.button}
                        onClick={() => ask('cancel', [booking])}
                      >
                        Отменить бронь
                      </button>
                    </>
                  )}

                  {booking.status === 'issued' && (
                    <button
                      type="button"
                      style={ui.button}
                      onClick={() => ask('return', [booking])}
                    >
                      Вернуть
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </details>

        {selected.length > 0 && (
          <div
            style={{
              ...ui.panel,
              marginTop: 16,
              marginBottom: 0,
              borderColor: '#55785c',
            }}
          >
            <p style={{ marginTop: 0 }}>
              Выбрано: {selected.length} поз.
            </p>

            <div style={buttonsStyle}>
              <button
                type="button"
                style={ui.button}
                disabled={!canIssueSelection}
                onClick={() => ask('issue', selected)}
              >
                Взять выбранное
              </button>

              <button
                type="button"
                style={ui.button}
                disabled={!canReturnSelection}
                onClick={() => ask('return', selected)}
              >
                Вернуть выбранное
              </button>
            </div>

            {!canIssueSelection && !canReturnSelection && (
              <p style={ui.muted}>
                Выберите либо предметы для выдачи, либо предметы
                на руках для возврата. Смешанный набор не обрабатывается.
              </p>
            )}
          </div>
        )}
      </fieldset>
    </article>
  );
}

export default function MyBookings({
  currentUser,
  onClose,
  onBookingsChanged,
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const actionLock = useRef(false);

  const { data, error, loading, reload } =
    useBookingData('/api/booking-v2/mine-groups');

  const groups = new Map();

  for (const booking of data?.bookings || []) {
    const key = booking.batch_id || booking.id;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(booking);
  }

  function refresh() {
    if (actionLock.current) return;
    reload();
  }

  async function runAction(items, action) {
    if (actionLock.current || items.length === 0) return;

    actionLock.current = true;
    setBusy(true);
    setMessage('');

    try {
      if (action === 'cancel' || !items[0].batch_id) {
        if (items.length !== 1) {
          throw new Error('Для этой записи доступно одиночное действие.');
        }

        await api.post(`/api/booking-v2/${items[0].id}/action`, {
          action,
        });
      } else {
        await api.post('/api/booking-v2/bulk-action', {
          bookingIds: items.map(item => item.id),
          action,
        });
      }

      const text = {
        issue: 'Выдача оформлена',
        return: 'Возврат оформлен',
        cancel: 'Бронь отменена',
      }[action];

      setMessage(`${text}. Обработано: ${items.length} поз.`);
    } catch (err) {
      setMessage(mutationError(err));
    } finally {
      // Даже при потерянном ответе операция могла сохраниться.
      // Повторно POST автоматически не отправляем.
      reload();

      try {
        await onBookingsChanged?.();
      } catch {
        setMessage(previous =>
          `${previous} Обновите также главный список оборудования.`
        );
      }

      actionLock.current = false;
      setBusy(false);
    }
  }

  return (
    <div style={ui.page}>
      <div style={ui.row}>
        <h2>Мои бронирования</h2>

        <div style={buttonsStyle}>
          <button
            type="button"
            style={ui.button}
            disabled={busy || loading}
            onClick={refresh}
          >
            Обновить
          </button>

          {onClose && (
            <button
              type="button"
              style={ui.button}
              disabled={busy}
              onClick={onClose}
            >
              Закрыть
            </button>
          )}
        </div>
      </div>

      <p style={ui.muted}>
        Пользователь: {currentUser}
        {data?.today && ` · Камчатка, ${displayDate(data.today)}`}
      </p>

      {message && <p role="status">{message}</p>}
      {busy && <p role="status">Выполняем операцию…</p>}
      {loading && <p>Загружаем комплекты…</p>}
      {error && <p role="alert" style={ui.error}>{error}</p>}

      {data && groups.size === 0 && (
        <div style={ui.panel}>
          Незавершённых бронирований и выдач нет.
        </div>
      )}

      {[...groups.entries()].map(([id, bookings]) => (
        <BookingGroup
          key={id}
          bookings={bookings}
          today={data.today}
          busy={busy || loading}
          onAction={runAction}
        />
      ))}

      <p style={ui.muted}>
        После завершения всех броней комплект исчезнет из текущего списка.
        Выбор предметов сбрасывается при обновлении данных.
      </p>
    </div>
  );
}
