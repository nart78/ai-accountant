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

  balanceSheet: async (asOfDate: string) => {
    const response = await api.get('/api/reports/balance-sheet', {
      params: { as_of_date: asOfDate },
    });
    return response.data;
  },

  trialBalance: async (asOfDate: string) => {
    const response = await api.get('/api/reports/trial-balance', {
      params: { as_of_date: asOfDate },
    });
    return response.data;
  },

  generalLedger: async (accountId: number, startDate: string, endDate: string) => {
    const response = await api.get('/api/reports/general-ledger', {
      params: { account_id: accountId, start_date: startDate, end_date: endDate },
    });
    return response.data;
  },

  arAging: async () => {
    const response = await api.get('/api/reports/ar-aging');
    return response.data;
  },

  gstWorksheet: async (startDate: string, endDate: string) => {
    const response = await api.get('/api/reports/gst-worksheet', {
      params: { start_date: startDate, end_date: endDate },
    });
    return response.data;
  },

  t2125: async (year: number) => {
    const response = await api.get('/api/reports/t2125', {
      params: { year },
    });
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

// Account (Chart of Accounts) API
export const accountAPI = {
  list: async (params?: { account_type?: string; active_only?: boolean; with_balances?: boolean }) => {
    const response = await api.get('/api/accounts/', { params });
    return response.data;
  },

  get: async (id: number) => {
    const response = await api.get(`/api/accounts/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/api/accounts/', data);
    return response.data;
  },

  update: async (id: number, data: any) => {
    const response = await api.patch(`/api/accounts/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/api/accounts/${id}`);
    return response.data;
  },

  seed: async () => {
    const response = await api.post('/api/accounts/seed');
    return response.data;
  },

  ledger: async (id: number, params?: { skip?: number; limit?: number }) => {
    const response = await api.get(`/api/accounts/${id}/ledger`, { params });
    return response.data;
  },
};

// Journal Entry API
export const journalEntryAPI = {
  list: async (params?: { skip?: number; limit?: number; entry_type?: string; start_date?: string; end_date?: string; account_id?: number }) => {
    const response = await api.get('/api/journal-entries/', { params });
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/api/journal-entries/${id}`);
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/api/journal-entries/', data);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/api/journal-entries/${id}`);
    return response.data;
  },
  migrate: async () => {
    const response = await api.post('/api/journal-entries/migrate');
    return response.data;
  },
};

// Bill (Accounts Payable) API
export const billAPI = {
  list: async (params?: { skip?: number; limit?: number; status?: string; vendor_id?: number }) => {
    const response = await api.get('/api/bills/', { params });
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/api/bills/${id}`);
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/api/bills/', data);
    return response.data;
  },
  update: async (id: number, data: any) => {
    const response = await api.patch(`/api/bills/${id}`, data);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/api/bills/${id}`);
    return response.data;
  },
  recordPayment: async (id: number, data: any) => {
    const response = await api.post(`/api/bills/${id}/payments`, data);
    return response.data;
  },
};

// Bank Account API
export const bankAccountAPI = {
  list: async () => {
    const response = await api.get('/api/bank-accounts/');
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/api/bank-accounts/${id}`);
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/api/bank-accounts/', data);
    return response.data;
  },
  update: async (id: number, data: any) => {
    const response = await api.patch(`/api/bank-accounts/${id}`, data);
    return response.data;
  },
  importCsv: async (id: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/api/bank-accounts/${id}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  transactions: async (id: number, params?: { skip?: number; limit?: number }) => {
    const response = await api.get(`/api/bank-accounts/${id}/transactions`, { params });
    return response.data;
  },
};

export default api;
