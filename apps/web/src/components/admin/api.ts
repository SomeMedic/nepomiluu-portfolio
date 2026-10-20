'use client';

export class AdminApiError extends Error {
  constructor(public status: number, message: string, public errors?: unknown) {
    super(message);
    this.name = 'AdminApiError';
  }
}

export function isRevisionConflict(error: unknown): boolean {
  return error instanceof AdminApiError && error.status === 409 && /changed in another editor|revision changed|another window/i.test(error.message);
}

export async function requestAdmin<T>(path: string, options: RequestInit = {}, csrfToken?: string): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (csrfToken && options.method && !['GET', 'HEAD'].includes(options.method.toUpperCase())) headers.set('x-csrf-token', csrfToken);
  const response = await fetch(`/api/admin${path}`, { ...options, headers, credentials: 'same-origin', cache: 'no-store' });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new AdminApiError(response.status, typeof data?.message === 'string' ? data.message : `Запрос не выполнен (${response.status}).`, data?.errors);
  return data as T;
}

export function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Не удалось выполнить запрос. Попробуйте ещё раз.';
  const messages: Record<string, string> = {
    'Invalid email or password': 'Неверная почта или пароль.',
    'Too many login attempts; retry in 15 minutes': 'Слишком много попыток входа. Попробуйте через 15 минут.',
    'Sign in required': 'Сеанс истёк. Войдите ещё раз.',
    'Invalid CSRF token': 'Сеанс изменился. Войдите ещё раз, чтобы продолжить.',
    'Project not found': 'Проект не найден.',
    'Slug is already in use': 'Этот адрес уже занят другим проектом.',
    'Slug cannot change after first publication': 'После первой публикации адрес проекта изменить нельзя.',
    'Choose another homepage project before removing this publication': 'Этот проект выбран для главной. Сначала замените его в разделе «Главная».',
    'Both languages and all publication fields must be complete': 'Заполните все поля публикации на русском и английском языках.',
    'First homepage project requires three complete stages in both languages': 'Первому проекту на главной нужны три этапа и заполненное вступление на двух языках.',
    'Homepage projects must be published': 'Для главной можно выбрать только опубликованные проекты.',
    'Content references missing media': 'Одно из выбранных изображений отсутствует. Выберите его заново.',
    'Choose an image file': 'Выберите изображение.',
    'Image exceeds 20 MiB': 'Размер изображения не должен превышать 20 МБ.',
    'Invalid or oversized image': 'Файл повреждён или изображение слишком большое.',
    'Only static JPEG, PNG, WebP or AVIF images are accepted': 'Выберите статичное изображение JPG, PNG, WebP или AVIF.',
    'Failed to fetch': 'Нет соединения с сервером. Изменения остаются в редакторе.',
    'Validation failed': 'Проверьте заполнение полей.',
  };
  if (isRevisionConflict(error)) return 'Проект изменён в другом окне. Загрузите актуальную версию перед сохранением.';
  return messages[error.message] || error.message;
}

export function errorDetails(errors: unknown): string[] {
  if (!errors) return [];
  if (Array.isArray(errors)) return errors.flatMap(errorDetails);
  if (typeof errors === 'string') return [errors];
  if (typeof errors === 'object') {
    const value = errors as Record<string, unknown>;
    if (typeof value.message === 'string') {
      const path = Array.isArray(value.path) ? `${value.path.join('.')} — ` : '';
      return [`${path}${value.message}`];
    }
    return Object.entries(value).flatMap(([key, item]) => errorDetails(item).map(text => `${key}: ${text}`));
  }
  return [];
}
