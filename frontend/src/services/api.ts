/**
 * API service for communicating with the backend
 */
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/api/auth/')) {
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

// Document API
export const documentAPI = {
  upload: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/api/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  list: async (params?: { skip?: number; limit?: number; status?: string }) => {
    const response = await api.get('/api/documents/', { params });
    return response.data;
  },

  get: async (id: number) => {
    const response = await api.get(`/api/documents/${id}`);
    return response.data;
  },

  review: async (id: number, approved: boolean, notes?: string) => {
    const response = await api.patch(`/api/documents/${id}/review`, {
      approved,
      notes,
    });
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/api/documents/${id}`);
    return response.data;
  },

  reprocess: async (id: number) => {
    const response = await api.post(`/api/documents/${id}/reprocess`);
    return response.data;
  },
};

// Transaction API
export const transactionAPI = {
  create: async (data: any) => {
    const response = await api.post('/api/transactions/', data);
    return response.data;
  },

  list: async (params?: {
    skip?: number;
    limit?: number;
    category?: string;
    start_date?: string;
    end_date?: string;
  }) => {
    const response = await api.get('/api/transactions/', { params });
    return response.data;
  },

  get: async (id: number) => {
    const response = await api.get(`/api/transactions/${id}`);
    return response.data;
  },

  update: async (id: number, data: any) => {
    const response = await api.patch(`/api/transactions/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/api/transactions/${id}`);
    return response.data;
  },

  approve: async (id: number) => {
    const response = await api.post(`/api/transactions/${id}/approve`);
    return response.data;
  },
};

// Reports API
export const reportsAPI = {
  profitLoss: async (startDate: string, endDate: string) => {
    const response = await api.get('/api/reports/profit-loss', {
      params: { start_date: startDate, end_date: endDate },
    });
    return response.data;
  },

  expensesByCategory: async (startDate: string, endDate: string) => {
    const response = await api.get('/api/reports/expenses-by-category', {
      params: { start_date: startDate, end_date: endDate },
    });
    return response.data;
  },

  taxSummary: async (year: number) => {
    const response = await api.get('/api/reports/tax-summary', {
      params: { year },
    });
    return response.data;
  },

  monthlySummary: async (year: number) => {
    const response = await api.get('/api/reports/monthly-summary', {
      params: { year },
    });
    return response.data;
  },

  dashboard: async () => {
    const response = await api.get('/api/reports/dashboard');
    return response.data;
  },
};

// Customer API
export const customerAPI = {
  create: async (data: any) => {
    const response = await api.post('/api/customers/', data);
    return response.data;
  },
  list: async (params?: { search?: string }) => {
    const response = await api.get('/api/customers/', { params });
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/api/customers/${id}`);
    return response.data;
  },
  update: async (id: number, data: any) => {
    const response = await api.patch(`/api/customers/${id}`, data);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/api/customers/${id}`);
    return response.data;
  },
};

// Invoice API
export const invoiceAPI = {
  create: async (data: any) => {
    const response = await api.post('/api/invoices/', data);
    return response.data;
  },
  list: async (params?: { skip?: number; limit?: number; status?: string; customer_id?: number }) => {
    const response = await api.get('/api/invoices/', { params });
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/api/invoices/${id}`);
    return response.data;
  },
  update: async (id: number, data: any) => {
    const response = await api.patch(`/api/invoices/${id}`, data);
    return response.data;
  },
  updateStatus: async (id: number, status: string) => {
    const response = await api.patch(`/api/invoices/${id}/status`, { status });
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/api/invoices/${id}`);
    return response.data;
  },
  downloadPdf: async (id: number) => {
    const response = await api.get(`/api/invoices/${id}/pdf`, { responseType: 'blob' });
    return response.data;
  },
};

export default api;
