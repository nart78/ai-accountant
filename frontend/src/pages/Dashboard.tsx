import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { reportsAPI } from '../services/api';

interface DashboardData {
  documents: { total: number; pending_review: number };
  this_month: { revenue: number; expenses: number; net_income: number };
  recent_uploads: Array<{
    id: number;
    filename: string;
    type: string | null;
    amount: number | null;
    status: string;
    created_at: string;
  }>;
}

const STATUS_STYLES: Record<string, string> = {
  processed: 'bg-green-100 text-green-800',
  review_needed: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-gray-100 text-gray-600',
  error: 'bg-red-100 text-red-800',
};

// Upcoming Canadian tax deadlines
const TAX_DEADLINES = [
  { label: 'GST/HST Quarterly Return', date: 'Apr 30, 2026', daysLeft: 72 },
  { label: 'T4 Slips to Employees', date: 'Feb 28, 2026', daysLeft: 11 },
  { label: 'Corporate Tax Filing', date: 'Jun 30, 2026', daysLeft: 133 },
];

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reportsAPI
      .dashboard()
      .then(setData)
      .catch(() => setError('Could not connect to backend. Make sure the server is running.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  // Show placeholder UI even if backend is offline
  const stats = data ?? {
    documents: { total: 0, pending_review: 0 },
    this_month: { revenue: 0, expenses: 0, net_income: 0 },
    recent_uploads: [],
  };

  return (
    <div className="px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <span className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <p className="text-sm text-gray-500 mb-1">Total Documents</p>
          <p className="text-3xl font-bold text-gray-900">{stats.documents.total}</p>
          <Link to="/documents" className="text-xs text-indigo-600 hover:underline mt-2 block">
            View all →
          </Link>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <p className="text-sm text-gray-500 mb-1">Needs Your Review</p>
          <p className="text-3xl font-bold text-yellow-600">{stats.documents.pending_review}</p>
          <Link to="/documents?status=review_needed" className="text-xs text-indigo-600 hover:underline mt-2 block">
            Review now →
          </Link>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <p className="text-sm text-gray-500 mb-1">Revenue This Month</p>
          <p className="text-3xl font-bold text-green-600">
            ${stats.this_month.revenue.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <p className="text-sm text-gray-500 mb-1">Net Income This Month</p>
          <p className={`text-3xl font-bold ${stats.this_month.net_income >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stats.this_month.net_income < 0 ? '-' : ''}$
            {Math.abs(stats.this_month.net_income).toLocaleString('en-CA', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Uploads */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent Documents</h2>
            <Link to="/documents" className="text-sm text-indigo-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y">
            {stats.recent_uploads.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400">
                <p className="text-4xl mb-3">📄</p>
                <p className="font-medium">No documents yet</p>
                <p className="text-sm mt-1">Upload your first receipt or invoice</p>
                <Link
                  to="/documents"
                  className="mt-4 inline-block bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700"
                >
                  Upload Document
                </Link>
              </div>
            ) : (
              stats.recent_uploads.map((doc) => (
                <div key={doc.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {doc.type ?? 'Processing...'} · {new Date(doc.created_at).toLocaleDateString('en-CA')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    {doc.amount != null && (
                      <span className="text-sm font-semibold text-gray-900">
                        ${doc.amount.toFixed(2)}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_STYLES[doc.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {doc.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Tax Deadlines */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="px-6 py-4 border-b">
            <h2 className="font-semibold text-gray-900">🇨🇦 Upcoming Deadlines</h2>
          </div>
          <div className="p-4 space-y-3">
            {TAX_DEADLINES.map((d) => (
              <div key={d.label} className={`rounded-lg p-4 ${d.daysLeft <= 30 ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                <p className="text-sm font-medium text-gray-900">{d.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{d.date}</p>
                <p className={`text-xs font-semibold mt-1 ${d.daysLeft <= 30 ? 'text-red-600' : 'text-gray-600'}`}>
                  {d.daysLeft} days away
                </p>
              </div>
            ))}
          </div>
          <div className="px-6 pb-4">
            <Link to="/reports" className="text-sm text-indigo-600 hover:underline">View tax summary →</Link>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/documents"
            className="flex items-center gap-3 bg-indigo-600 text-white rounded-xl p-5 hover:bg-indigo-700 transition"
          >
            <span className="text-2xl">📤</span>
            <div>
              <p className="font-semibold">Upload Documents</p>
              <p className="text-indigo-200 text-sm">Receipts, invoices, statements</p>
            </div>
          </Link>
          <Link
            to="/reports"
            className="flex items-center gap-3 bg-green-600 text-white rounded-xl p-5 hover:bg-green-700 transition"
          >
            <span className="text-2xl">📊</span>
            <div>
              <p className="font-semibold">View Reports</p>
              <p className="text-green-200 text-sm">P&amp;L, tax summary, expenses</p>
            </div>
          </Link>
          <Link
            to="/documents?status=review_needed"
            className="flex items-center gap-3 bg-yellow-500 text-white rounded-xl p-5 hover:bg-yellow-600 transition"
          >
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-semibold">Review Queue</p>
              <p className="text-yellow-100 text-sm">Approve AI categorizations</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
