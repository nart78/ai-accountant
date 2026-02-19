import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { billAPI } from '../services/api';
import { Plus, Search, FileInput, Trash2, Eye, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Bill {
  id: number;
  bill_number: string;
  vendor_id: number;
  vendor_name: string;
  bill_date: string;
  due_date: string;
  status: string;
  subtotal: number;
  gst_amount: number;
  total: number;
  amount_paid: number;
  notes: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  draft: {
    bg: 'bg-slate-50 border-slate-200',
    text: 'text-slate-600',
    dot: 'bg-slate-400',
    label: 'Draft',
  },
  received: {
    bg: 'bg-indigo-50 border-indigo-200',
    text: 'text-indigo-700',
    dot: 'bg-indigo-500',
    label: 'Received',
  },
  paid: {
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'Paid',
  },
  overdue: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-700',
    dot: 'bg-red-500',
    label: 'Overdue',
  },
};

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'received', label: 'Received' },
  { key: 'paid', label: 'Paid' },
  { key: 'overdue', label: 'Overdue' },
] as const;

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? {
    bg: 'bg-slate-50 border-slate-200',
    text: 'text-slate-600',
    dot: 'bg-slate-400',
    label: status,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${config.bg} ${config.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <FileInput className="w-8 h-8 text-slate-300" />
      </div>
      <p className="text-base font-semibold text-slate-500">No bills found</p>
      <p className="text-sm text-slate-400 mt-1">
        Create a new bill to get started
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
      <p className="text-sm font-medium text-slate-400">Loading bills...</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function Bills() {
  const navigate = useNavigate();
  const [bills, setBills] = useState<Bill[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);

  // Load bills whenever filter or page changes
  useEffect(() => {
    loadBills();
  }, [filter, page]);

  // Reset to page 0 when filter changes
  useEffect(() => {
    setPage(0);
  }, [filter]);

  const loadBills = async () => {
    setLoading(true);
    try {
      const params: { skip?: number; limit?: number; status?: string } = {
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      };
      if (filter !== 'all') {
        params.status = filter;
      }
      const result = await billAPI.list(params);
      setBills(result.bills ?? []);
      setTotal(result.total ?? 0);
    } catch {
      setBills([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (bill: Bill) => {
    if (!confirm(`Delete bill "${bill.bill_number}"?`)) return;
    await billAPI.delete(bill.id);
    loadBills();
  };

  // Client-side search filtering
  const filteredBills = bills.filter((bill) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      bill.bill_number.toLowerCase().includes(q) ||
      bill.vendor_name.toLowerCase().includes(q)
    );
  });

  // Stats (computed from current page of bills -- totals across all pages would
  // require a dedicated stats endpoint; for now we show the loaded-page stats
  // consistent with how Invoices.tsx works)
  const totalBills = total;
  const outstanding = bills
    .filter((b) => b.status === 'received' || b.status === 'overdue')
    .reduce((sum, b) => sum + (b.total - b.amount_paid), 0);
  const overdueCount = bills.filter((b) => b.status === 'overdue').length;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Bills</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track vendor bills and accounts payable
          </p>
        </div>
        <button
          onClick={() => navigate('/bills/new')}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-sm shadow-indigo-500/25"
        >
          <Plus className="w-4 h-4" />
          New Bill
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTER_TABS.map((tab) => {
          const isActive = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-all ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search bills..."
          className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all placeholder:text-slate-400"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Bills</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalBills}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Outstanding</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{formatCurrency(outstanding)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Overdue</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{overdueCount}</p>
        </div>
      </div>

      {/* Bill List */}
      {loading ? (
        <LoadingState />
      ) : filteredBills.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="min-w-full">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Bill #
                  </th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Vendor
                  </th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Date
                  </th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Due Date
                  </th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Total
                  </th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Paid
                  </th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Balance
                  </th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Status
                  </th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.map((bill) => (
                  <tr
                    key={bill.id}
                    className="group hover:bg-slate-50/80 cursor-pointer transition-colors border-b border-slate-100 last:border-b-0"
                    onClick={() => navigate(`/bills/${bill.id}/edit`)}
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-slate-800">{bill.bill_number}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-slate-700">{bill.vendor_name}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-600">{formatDate(bill.bill_date)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-600">{formatDate(bill.due_date)}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-sm font-semibold text-slate-800 tabular-nums">
                        {formatCurrency(bill.total)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-sm text-slate-600 tabular-nums">
                        {formatCurrency(bill.amount_paid)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-sm font-semibold text-slate-800 tabular-nums">
                        {formatCurrency(bill.total - bill.amount_paid)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={bill.status} />
                    </td>
                    <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => navigate(`/bills/${bill.id}/edit`)}
                          title="View / Edit"
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {bill.status === 'draft' && (
                          <button
                            onClick={() => handleDelete(bill)}
                            title="Delete"
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {filteredBills.map((bill) => (
              <div
                key={bill.id}
                className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
                onClick={() => navigate(`/bills/${bill.id}/edit`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{bill.bill_number}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{bill.vendor_name}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-800 tabular-nums flex-shrink-0">
                    {formatCurrency(bill.total)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Paid: {formatCurrency(bill.amount_paid)}</span>
                  <span>Balance: {formatCurrency(bill.total - bill.amount_paid)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>Due {formatDate(bill.due_date)}</span>
                  </div>
                  <StatusBadge status={bill.status} />
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Showing {filteredBills.length} bill{filteredBills.length !== 1 ? 's' : ''}
              {searchQuery ? ` matching "${searchQuery}"` : ''}
              {total > PAGE_SIZE ? ` (page ${page + 1} of ${totalPages})` : ''}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
