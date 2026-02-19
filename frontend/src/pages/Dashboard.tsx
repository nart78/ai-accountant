import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { reportsAPI } from '../services/api';
import {
  FileText,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Clock,
  Upload,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  processed: {
    label: 'Processed',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
  },
  review_needed: {
    label: 'Needs Review',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
  },
  pending: {
    label: 'Pending',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    dot: 'bg-slate-400',
  },
  error: {
    label: 'Error',
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-500',
  },
};

const TAX_DEADLINES = [
  { label: 'T4 Slips to Employees', date: 'Feb 28, 2026', daysLeft: 11, icon: AlertCircle },
  { label: 'GST/HST Quarterly Return', date: 'Apr 30, 2026', daysLeft: 72, icon: Clock },
  { label: 'Corporate Tax Filing', date: 'Jun 30, 2026', daysLeft: 133, icon: Clock },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
  }).format(value);
}

function getDeadlineUrgency(daysLeft: number) {
  if (daysLeft <= 14)
    return {
      border: 'border-red-200',
      bg: 'bg-gradient-to-br from-red-50 to-red-100/60',
      badge: 'bg-red-100 text-red-700',
      text: 'text-red-700',
    };
  if (daysLeft <= 45)
    return {
      border: 'border-amber-200',
      bg: 'bg-gradient-to-br from-amber-50 to-amber-100/60',
      badge: 'bg-amber-100 text-amber-700',
      text: 'text-amber-700',
    };
  return {
    border: 'border-slate-200',
    bg: 'bg-gradient-to-br from-slate-50 to-slate-100/40',
    badge: 'bg-slate-100 text-slate-600',
    text: 'text-slate-600',
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  subtext,
  trend,
  link,
  borderColor,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
  link?: { to: string; label: string };
  borderColor: string;
}) {
  return (
    <div
      className={`relative bg-white rounded-xl shadow-sm border-l-4 ${borderColor} border border-l-4 border-slate-100 p-6 transition-shadow hover:shadow-md`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-slate-900 tracking-tight">{value}</p>
          {subtext && (
            <p className="text-xs text-slate-400 mt-1">{subtext}</p>
          )}
        </div>
        <div className={`flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-lg ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} strokeWidth={2} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        {trend === 'up' && (
          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600">
            <ArrowUpRight className="w-3.5 h-3.5" /> Positive
          </span>
        )}
        {trend === 'down' && (
          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-600">
            <ArrowDownRight className="w-3.5 h-3.5" /> Negative
          </span>
        )}
        {trend === 'neutral' && <span />}
        {!trend && <span />}
        {link && (
          <Link
            to={link.to}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            {link.label} &rarr;
          </Link>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${cfg.bg} ${cfg.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header skeleton */}
        <div className="flex items-end justify-between">
          <div>
            <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse" />
            <div className="h-4 w-64 bg-slate-200 rounded mt-2 animate-pulse" />
          </div>
          <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
        </div>
        {/* Stat cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
                  <div className="h-7 w-32 bg-slate-200 rounded animate-pulse" />
                </div>
                <div className="w-11 h-11 bg-slate-200 rounded-lg animate-pulse" />
              </div>
              <div className="h-3 w-16 bg-slate-200 rounded mt-4 animate-pulse" />
            </div>
          ))}
        </div>
        {/* Table and sidebar skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100">
              <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center justify-between border-b border-slate-50">
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-32 bg-slate-200 rounded animate-pulse" />
                </div>
                <div className="h-6 w-20 bg-slate-200 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <div className="h-5 w-40 bg-slate-200 rounded animate-pulse mb-4" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-slate-200 rounded-lg animate-pulse mb-3" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
      <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-amber-800">Connection Issue</p>
        <p className="text-sm text-amber-700 mt-0.5">{message}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

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
    return <DashboardSkeleton />;
  }

  const stats = data ?? {
    documents: { total: 0, pending_review: 0 },
    this_month: { revenue: 0, expenses: 0, net_income: 0 },
    recent_uploads: [],
  };

  const netPositive = stats.this_month.net_income >= 0;

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ---------------------------------------------------------------- */}
        {/* Header                                                           */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">
              Financial overview for{' '}
              {new Date().toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <span className="text-sm text-slate-400 tabular-nums">
            {new Date().toLocaleDateString('en-CA', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>

        {error && <ErrorBanner message={error} />}

        {/* ---------------------------------------------------------------- */}
        {/* KPI Stat Cards                                                   */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={FileText}
            iconBg="bg-indigo-50"
            iconColor="text-indigo-600"
            borderColor="border-l-indigo-500"
            label="Total Documents"
            value={stats.documents.total.toLocaleString('en-CA')}
            link={{ to: '/documents', label: 'View all' }}
          />
          <StatCard
            icon={AlertCircle}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
            borderColor="border-l-amber-500"
            label="Needs Review"
            value={stats.documents.pending_review.toLocaleString('en-CA')}
            subtext={
              stats.documents.pending_review > 0
                ? `${stats.documents.pending_review} item${stats.documents.pending_review !== 1 ? 's' : ''} awaiting approval`
                : 'All caught up'
            }
            link={{ to: '/documents?status=review_needed', label: 'Review now' }}
          />
          <StatCard
            icon={DollarSign}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            borderColor="border-l-emerald-500"
            label="Revenue This Month"
            value={formatCurrency(stats.this_month.revenue)}
            trend="up"
          />
          <StatCard
            icon={TrendingUp}
            iconBg={netPositive ? 'bg-emerald-50' : 'bg-red-50'}
            iconColor={netPositive ? 'text-emerald-600' : 'text-red-600'}
            borderColor={netPositive ? 'border-l-emerald-500' : 'border-l-red-500'}
            label="Net Income"
            value={formatCurrency(stats.this_month.net_income)}
            subtext={`Expenses: ${formatCurrency(stats.this_month.expenses)}`}
            trend={netPositive ? 'up' : 'down'}
          />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Main content grid                                                */}
        {/* ---------------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Documents */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <h2 className="font-semibold text-slate-900">Recent Documents</h2>
              </div>
              <Link
                to="/documents"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                View all &rarr;
              </Link>
            </div>

            {stats.recent_uploads.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <FileText className="w-6 h-6 text-slate-400" />
                </div>
                <p className="font-medium text-slate-700">No documents yet</p>
                <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">
                  Upload your first receipt or invoice to get started with automated bookkeeping.
                </p>
                <Link
                  to="/documents"
                  className="mt-5 inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  Upload Document
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-3">
                        Document
                      </th>
                      <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-3 hidden sm:table-cell">
                        Date
                      </th>
                      <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-3">
                        Amount
                      </th>
                      <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-3">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {stats.recent_uploads.map((doc) => (
                      <tr
                        key={doc.id}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                              <FileText className="w-4 h-4 text-indigo-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate max-w-[200px]">
                                {doc.filename}
                              </p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {doc.type ?? 'Processing...'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 hidden sm:table-cell">
                          <span className="text-sm text-slate-500 tabular-nums">
                            {new Date(doc.created_at).toLocaleDateString('en-CA')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {doc.amount != null ? (
                            <span className="text-sm font-semibold text-slate-900 tabular-nums">
                              {formatCurrency(doc.amount)}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-300">&mdash;</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <StatusBadge status={doc.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Tax Deadlines */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <h2 className="font-semibold text-slate-900">Upcoming Deadlines</h2>
            </div>
            <div className="p-4 space-y-3">
              {TAX_DEADLINES.map((d) => {
                const urgency = getDeadlineUrgency(d.daysLeft);
                const DeadlineIcon = d.icon;
                return (
                  <div
                    key={d.label}
                    className={`rounded-xl border p-4 ${urgency.border} ${urgency.bg} transition-shadow hover:shadow-sm`}
                  >
                    <div className="flex items-start gap-3">
                      <DeadlineIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${urgency.text}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{d.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{d.date}</p>
                        <span
                          className={`inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full ${urgency.badge}`}
                        >
                          {d.daysLeft} day{d.daysLeft !== 1 ? 's' : ''} remaining
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-6 py-4 border-t border-slate-100">
              <Link
                to="/reports"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                View tax summary &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Quick Actions                                                    */}
        {/* ---------------------------------------------------------------- */}
        <div>
          <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              to="/documents"
              className="group flex items-center gap-4 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-xl p-5 hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-sm hover:shadow-md"
            >
              <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-white/15 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold">Upload Documents</p>
                <p className="text-indigo-200 text-sm mt-0.5">Receipts, invoices, statements</p>
              </div>
            </Link>
            <Link
              to="/reports"
              className="group flex items-center gap-4 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white rounded-xl p-5 hover:from-emerald-700 hover:to-emerald-800 transition-all shadow-sm hover:shadow-md"
            >
              <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-white/15 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold">View Reports</p>
                <p className="text-emerald-200 text-sm mt-0.5">P&amp;L, tax summary, expenses</p>
              </div>
            </Link>
            <Link
              to="/documents?status=review_needed"
              className="group flex items-center gap-4 bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-xl p-5 hover:from-amber-600 hover:to-amber-700 transition-all shadow-sm hover:shadow-md"
            >
              <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-white/15 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold">Review Queue</p>
                <p className="text-amber-100 text-sm mt-0.5">Approve AI categorizations</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
