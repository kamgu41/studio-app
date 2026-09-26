import { useEffect, useRef, useState } from 'react';
import EquipmentList from './components/EquipmentList';
import { supabase } from './supabaseClient';
import api, { setApiAccount } from './api';
import './App.css';
import './Auth.css';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);

  async function handleLogin(event) {
    event.preventDefault();
    if (lock.current) return;

    lock.current = true;
    setBusy(true);
    setError('');

    try {
      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        if (loginError.code === 'invalid_credentials') {
          setError('Неверный email или пароль.');
        } else if (loginError.code === 'email_not_confirmed') {
          setError('Email аккаунта ещё не подтверждён.');
        } else if (loginError.status === 429) {
          setError('Слишком много попыток. Попробуйте позже.');
        } else {
          setError(
            'Вход не выполнен. Проверьте подключение и настройки аккаунта.'
          );
        }
      }
    } catch {
      setError('Не удалось связаться с сервисом входа.');
    } finally {
      setPassword('');
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <h1>КАМФИЛЬМ</h1>
        <p>Вход в учёт оборудования</p>

        <form onSubmit={handleLogin}>
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={event => setEmail(event.target.value)}
              disabled={busy}
              required
            />
          </label>

          <label>
            Пароль
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              disabled={busy}
              required
            />
          </label>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button type="submit" disabled={busy}>
            {busy ? 'Входим…' : 'Войти'}
          </button>
        </form>

        <p className="auth-note">
          Используйте аккаунт, созданный для вас в студии.
          На общем компьютере выходите после работы.
        </p>
      </section>
    </main>
  );
}

function AccountWorkspace({ userId }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const logoutLock = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProfile() {
      try {
        const { data } = await api.get('/api/me', {
          signal: controller.signal,
        });

        if (
          data?.user?.id !== userId ||
          typeof data.user.fullName !== 'string'
        ) {
          throw new Error('Получен некорректный профиль аккаунта.');
        }

        if (!controller.signal.aborted) {
          setProfile(data.user);
          setError('');
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setProfile(null);
          setError(
            err.response?.data?.error ||
            'Не удалось загрузить профиль. Проверьте, запущен ли бэкенд.'
          );
        }
      }
    }

    loadProfile();
    return () => controller.abort();
  }, [userId, revision]);

  useEffect(() => {
    function handleAuthRequired(event) {
      if (event.detail?.accountId !== userId) return;

      setProfile(null);
      setError(event.detail.message);
    }

    window.addEventListener('studio-auth-required', handleAuthRequired);

    return () => {
      window.removeEventListener(
        'studio-auth-required',
        handleAuthRequired
      );
    };
  }, [userId]);

  function retryProfile() {
    setProfile(null);
    setError('');
    setRevision(value => value + 1);
  }

  async function handleLogout() {
    if (logoutLock.current) return;

    logoutLock.current = true;
    setLeaving(true);
    setError('');

    try {
      const { error: logoutError } = await supabase.auth.signOut({
        scope: 'local',
      });

      if (logoutError) throw logoutError;
    } catch {
      setProfile(null);
      setError(
        'Выход не завершён. Проверьте соединение и нажмите «Выйти» ещё раз.'
      );
    } finally {
      logoutLock.current = false;
      setLeaving(false);
    }
  }

  return (
    <div className="App">
      <div className="account-bar">
        <span>{profile?.fullName || 'Личный аккаунт'}</span>
        <button
          type="button"
          onClick={handleLogout}
          disabled={leaving}
        >
          {leaving ? 'Выходим…' : 'Выйти'}
        </button>
      </div>

      {leaving ? (
        <div className="auth-status">Завершаем сеанс…</div>
      ) : error ? (
        <div className="auth-status">
          <p role="alert" className="auth-error">{error}</p>
          <button type="button" onClick={retryProfile}>
            Повторить проверку
          </button>
        </div>
      ) : !profile ? (
        <div className="auth-status">Проверяем аккаунт…</div>
      ) : (
        <EquipmentList
          key={profile.id}
          currentUser={profile.fullName}
        />
      )}
    </div>
  );
}

export default function App() {
  // undefined — начальная сессия ещё не прочитана;
  // null — пользователь не вошёл.
  const [userId, setUserId] = useState(undefined);

  useEffect(() => {
    // Старое имя больше не используется для входа.
    localStorage.removeItem('currentUser');

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_event, session) => {
        const nextId = session?.user?.id || null;

        setApiAccount(nextId);
        setUserId(nextId);
      });

    return () => subscription.unsubscribe();
  }, []);

  if (userId === undefined) {
    return <div className="auth-status">Проверяем сохранённый вход…</div>;
  }

  if (!userId) {
    return <LoginPage />;
  }

  return <AccountWorkspace key={userId} userId={userId} />;
}
