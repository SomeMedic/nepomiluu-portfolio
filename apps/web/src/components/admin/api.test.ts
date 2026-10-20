import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminApiError, errorDetails, errorMessage, isRevisionConflict, requestAdmin } from './api';

afterEach(() => { vi.unstubAllGlobals(); });

describe('admin request boundary', () => {
  it('sends cookies and CSRF for a JSON mutation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ revision: 3 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(requestAdmin('/projects/a', { method: 'PATCH', body: JSON.stringify({ revision: 2 }) }, 'csrf-value')).resolves.toEqual({ revision: 3 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/admin/projects/a');
    expect(init.credentials).toBe('same-origin');
    expect(init.cache).toBe('no-store');
    expect(init.headers.get('x-csrf-token')).toBe('csrf-value');
    expect(init.headers.get('Content-Type')).toBe('application/json');
  });

  it('lets the browser set the multipart boundary for image uploads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'media' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const body = new FormData(); body.append('file', new Blob(['image'], { type: 'image/webp' }), 'cover.webp');
    await requestAdmin('/media', { method: 'POST', body }, 'csrf');
    const init = fetchMock.mock.calls[0]![1];
    expect(init.headers.has('Content-Type')).toBe(false);
    expect(init.headers.get('x-csrf-token')).toBe('csrf');
    expect(init.body).toBe(body);
  });

  it('does not send a CSRF token in a read request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await requestAdmin('/projects', {}, 'csrf');
    expect(fetchMock.mock.calls[0]![1].headers.has('x-csrf-token')).toBe(false);
  });

  it('retains server validation details and response status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Validation failed', errors: { fieldErrors: { slug: ['Invalid'] } } }), { status: 400 })));
    try {
      await requestAdmin('/projects', { method: 'POST', body: '{}' }, 'csrf');
      expect.fail('Expected a validation error');
    } catch (error) {
      expect(error).toBeInstanceOf(AdminApiError);
      expect((error as AdminApiError).status).toBe(400);
      expect(errorDetails((error as AdminApiError).errors)).toEqual(['fieldErrors: slug: Invalid']);
      expect(errorMessage(error)).toBe('Проверьте заполнение полей.');
    }
  });

  it('distinguishes revision conflicts from correctable slug and homepage conflicts', () => {
    expect(isRevisionConflict(new AdminApiError(409, 'Project changed in another editor; reload before saving'))).toBe(true);
    expect(isRevisionConflict(new AdminApiError(409, 'Project revision changed'))).toBe(true);
    expect(isRevisionConflict(new AdminApiError(409, 'Slug is already in use'))).toBe(false);
    expect(isRevisionConflict(new AdminApiError(409, 'Choose another homepage project before removing this publication'))).toBe(false);
  });
});
