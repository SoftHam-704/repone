const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const api = async (path, options = {}) => {
    const token = sessionStorage.getItem('token');
    const res = await fetch(`${BASE}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
        ...options,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Erro ${res.status}`);
    return data;
};
