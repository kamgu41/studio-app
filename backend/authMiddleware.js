module.exports = function createAuthMiddleware(supabase) {
  return async function requireAccount(req, res, next) {
    res.set('Cache-Control', 'no-store');

    const authorization = req.get('authorization') || '';
    const match = /^Bearer\s+(\S+)$/i.exec(authorization);

    if (!match) {
      return res.status(401).json({
        error: 'Необходимо войти в аккаунт',
      });
    }

    try {
      const { data, error } = await supabase.auth.getUser(match[1]);

      if (error) {
        const unavailable =
          error.name === 'AuthRetryableFetchError' ||
          Number(error.status) >= 500;

        return res.status(unavailable ? 503 : 401).json({
          error: unavailable
            ? 'Сервис входа временно недоступен. Повторите позже.'
            : 'Сессия недействительна. Войдите снова.',
        });
      }

      const user = data?.user;

      if (!user || user.is_anonymous) {
        return res.status(401).json({
          error: 'Необходимо войти в личный аккаунт',
        });
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Ошибка загрузки профиля:', profileError.code);

        return res.status(503).json({
          error: 'Не удалось загрузить профиль. Повторите позже.',
        });
      }

      if (!profile) {
        return res.status(403).json({
          error: 'Профиль аккаунта не создан. Нужна проверка настройки.',
        });
      }

      const fullName = profile.full_name?.trim();

      if (!fullName || fullName.length > 100) {
        return res.status(403).json({
          error: 'В профиле нужно указать имя от 1 до 100 символов.',
        });
      }

      // Эти значения получены сервером, а не из req.body.
      req.account = {
        id: user.id,
        email: user.email || '',
        fullName,
      };

      return next();
    } catch {
      // Не выводим заголовок Authorization и токен в журнал.
      console.error('Не удалось выполнить проверку аккаунта');

      return res.status(503).json({
        error: 'Проверка входа временно недоступна.',
      });
    }
  };
};
