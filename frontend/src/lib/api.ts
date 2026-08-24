const API_BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
        ? detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(', ') || 'Request failed'
        : res.statusText || 'Request failed';
    const error = new Error(message) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  exercises: {
    list: () => request<any[]>('/exercises'),
    get: (id: number) => request<any>(`/exercises/${id}`),
    create: (data: any) => request<any>('/exercises', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/exercises/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/exercises/${id}`, { method: 'DELETE' }),
  },
  sessions: {
    create: (data: any) => request<any>('/sessions', { method: 'POST', body: JSON.stringify(data) }),
    list: (params?: { patient?: string; exercise_id?: number }) => {
      const qs = new URLSearchParams();
      if (params?.patient) qs.set('patient', params.patient);
      if (params?.exercise_id) qs.set('exercise_id', String(params.exercise_id));
      const query = qs.toString();
      return request<any[]>(`/sessions${query ? `?${query}` : ''}`);
    },
  },
  progress: {
    get: (patientName: string) => request<any>(`/progress/${encodeURIComponent(patientName)}`),
  },
};
