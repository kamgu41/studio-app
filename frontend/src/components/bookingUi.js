import { useEffect, useState } from 'react';
import axios from 'axios';

export function displayDate(value) {
  if (!value) return '—';
  return value.split('-').reverse().join('.');
}

export function requestError(error) {
  return error.response?.data?.error || error.message || 'Ошибка запроса';
}

export function mutationError(error) {
  if (!error.response) {
    return (
      'Ответ сервера не получен. Операция могла сохраниться. ' +
      'Перед повторной попыткой обновите «Мои бронирования».'
    );
  }

  return requestError(error);
}

export function useBookingData(url) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({
    key: '',
    data: null,
    error: '',
  });

  const key = `${url || ''}|${revision}`;

  useEffect(() => {
    if (!url) return undefined;

    const controller = new AbortController();
    const requestKey = `${url}|${revision}`;

    async function load() {
      try {
        const { data } = await axios.get(url, {
          signal: controller.signal,
          timeout: 15000,
        });

        if (
          !data ||
          typeof data.today !== 'string' ||
          !Array.isArray(data.bookings)
        ) {
          throw new Error(
            'Неожиданный ответ API. Проверьте сервер и прокси Vite.'
          );
        }

        if (!controller.signal.aborted) {
          setResult({ key: requestKey, data, error: '' });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setResult({
            key: requestKey,
            data: null,
            error: requestError(error),
          });
        }
      }
    }

    load();

    return () => controller.abort();
  }, [url, revision]);

  const current = result.key === key;

  return {
    data: current ? result.data : null,
    error: current ? result.error : '',
    loading: Boolean(url) && !current,
    reload: () => setRevision(value => value + 1),
  };
}

export const ui = {
  page: {
    maxWidth: 900,
    margin: '0 auto',
    padding: 20,
    color: '#eee',
  },
  panel: {
    background: '#111',
    border: '1px solid #333',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  button: {
    padding: '9px 14px',
    border: '1px solid #444',
    borderRadius: 6,
    background: '#252525',
    color: '#eee',
    cursor: 'pointer',
  },
  input: {
    boxSizing: 'border-box',
    width: '100%',
    padding: 10,
    border: '1px solid #444',
    borderRadius: 6,
    background: '#161616',
    color: '#eee',
    colorScheme: 'dark',
  },
  muted: {
    color: '#aaa',
    fontSize: 13,
  },
  error: {
    color: '#ffb4b4',
    whiteSpace: 'pre-wrap',
  },
};
