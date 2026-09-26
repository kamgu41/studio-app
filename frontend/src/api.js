import axios from 'axios';
import { supabase } from './supabaseClient';

const api = axios.create({
  timeout: 20000,
});

let accountId = null;

// Вызывается при изменении сессии.
// Это защита от смешивания запросов разных аккаунтов в интерфейсе.
// Настоящую проверку прав всё равно выполняет сервер.
export function setApiAccount(id) {
  accountId = id || null;
}

api.interceptors.request.use(async config => {
  // Этот клиент разрешено использовать только для нашего API.
  if (
    config.baseURL ||
    typeof config.url !== 'string' ||
    !config.url.startsWith('/api/')
  ) {
    throw new Error('Недопустимый адрес запроса API');
  }

  const expectedAccount = accountId;

  if (!expectedAccount) {
    throw new Error('Необходимо войти в аккаунт');
  }

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error('Не удалось получить сессию. Повторите вход.');
  }

  if (
    accountId !== expectedAccount ||
    data.session?.user.id !== expectedAccount
  ) {
    throw new axios.CanceledError(
      'Аккаунт изменился. Старый запрос отменён.'
    );
  }

  if (!data.session?.access_token) {
    throw new Error('Сессия отсутствует. Войдите снова.');
  }

  config.headers.set(
    'Authorization',
    `Bearer ${data.session.access_token}`
  );

  config.accountId = expectedAccount;
  return config;
});

api.interceptors.response.use(
  response => {
    if (response.config.accountId !== accountId) {
      throw new axios.CanceledError(
        'Ответ относится к предыдущему аккаунту'
      );
    }

    return response;
  },
  error => {
    // Не повторяем автоматически бронирование, выдачу или возврат.
    if (
      error.response?.status === 401 &&
      error.config?.accountId === accountId
    ) {
      window.dispatchEvent(new CustomEvent('studio-auth-required', {
        detail: {
          accountId,
          message: 'Сервер отклонил сессию. Выйдите и войдите снова.',
        },
      }));
    }

    return Promise.reject(error);
  }
);

export default api;
