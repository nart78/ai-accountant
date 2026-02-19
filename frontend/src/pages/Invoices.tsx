import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoiceAPI } from '../services/api';
import { Plus, Search, FileText, Download, CheckCircle, Send, Trash2, Eye, X, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Invoice {
  id: number;
  invoice_number: string;
  customer_id: number;
  customer_name: string;
  invoice_date: string;
  due_date: string;
  paid_date: string | null;
  status: string;
  subtotal: number;
  gst_rate: number;
  gst_amount: number;
  total: number;
  notes: string | null;
  created_at: string;
}

interface InvoiceDetail extends Invoice {
  items: { id: number; description: string; quantity: number; unit_price: number; amount: number }[];
  customer: { id: number; name: string; email: string; phone: string; address_line1: string; address_line2: string; city: string; province: string; postal_code: string };
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
  sent: {
    bg: 'bg-indigo-50 border-indigo-200',
    text: 'text-indigo-700',
    dot: 'bg-indigo-500',
    label: 'Sent',
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
  { key: 'sent', label: 'Sent' },
  { key: 'paid', label: 'Paid' },
  { key: 'overdue', label: 'Overdue' },
] as const;

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
        <FileText className="w-8 h-8 text-slate-300" />
      </div>
      <p className="text-base font-semibold text-slate-500">No invoices found</p>
      <p className="text-sm text-slate-400 mt-1">
        Create a new invoice to get started
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
      <p className="text-sm font-medium text-slate-400">Loading invoices...</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail Modal
// ---------------------------------------------------------------------------

function DetailModal({
  invoice,
  detail,
  detailLoading,
  onClose,
  onDownloadPdf,
  onMarkSent,
  onMarkPaid,
  onDelete,
}: {
  invoice: Invoice;
  detail: InvoiceDetail | null;
  detailLoading: boolean;
  onClose: () => void;
  onDownloadPdf: () => void;
  onMarkSent: () => void;
  onMarkPaid: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900 truncate">
                  Invoice {invoice.invoice_number}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {invoice.customer_name}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <StatusBadge status={invoice.status} />
          </div>
        </div>

        {detailLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin mb-2" />
            <p className="text-sm text-slate-400">Loading invoice details...</p>
          </div>
        ) : detail ? (
          <>
            {/* Invoice Info */}
            <div className="px-6 py-5">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Invoice Number</p>
                  <p className="text-sm font-medium text-slate-800">{detail.invoice_number}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</p>
                  <StatusBadge status={detail.status} />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Invoice Date</p>
                  <p className="text-sm font-medium text-slate-800">{formatDate(detail.invoice_date)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Due Date</p>
                  <p className="text-sm font-medium text-slate-800">{formatDate(detail.due_date)}</p>
                </div>
                {detail.paid_date && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Paid Date</p>
                    <p className="text-sm font-medium text-slate-800">{formatDate(detail.paid_date)}</p>
                  </div>
                )}
              </div>

              {/* Customer Details */}
              {detail.customer && (
                <div className="mt-6 p-4 bg-slate-50 rounded-xl">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Customer</p>
                  <p className="text-sm font-semibold text-slate-800">{detail.customer.name}</p>
                  {detail.customer.email && (
                    <p className="text-sm text-slate-600">{detail.customer.email}</p>
                  )}
                  {detail.customer.phone && (
                    <p className="text-sm text-slate-600">{detail.customer.phone}</p>
                  )}
                  {detail.customer.address_line1 && (
                    <p className="text-sm text-slate-600 mt-1">
                      {detail.customer.address_line1}
                      {detail.customer.address_line2 && `, ${detail.customer.address_line2}`}
                      {detail.customer.city && `, ${detail.customer.city}`}
                      {detail.customer.province && `, ${detail.customer.province}`}
                      {detail.customer.postal_code && ` ${detail.customer.postal_code}`}
                    </p>
                  )}
                </div>
              )}

              {/* Line Items Table */}
              {detail.items && detail.items.length > 0 && (
                <div className="mt-6">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">Line Items</p>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="min-w-full">
                      <thead>
                        <tr className="bg-slate-50/80">
                          <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Description</th>
                          <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Qty</th>
                          <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Unit Price</th>
                          <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.items.map((item) => (
                          <tr key={item.id} className="border-t border-slate-100">
                            <td className="px-4 py-3 text-sm text-slate-700">{item.description}</td>
                            <td className="px-4 py-3 text-sm text-slate-700 text-right tabular-nums">{item.quantity}</td>
                            <td className="px-4 py-3 text-sm text-slate-700 text-right tabular-nums">{formatCurrency(item.unit_price)}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-slate-800 text-right tabular-nums">{formatCurrency(item.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="mt-4 flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-8 text-sm">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-medium text-slate-700 tabular-nums">{formatCurrency(detail.subtotal)}</span>
                    </div>
                    {detail.gst_amount > 0 && (
                      <div className="flex items-center gap-8 text-sm">
                        <span className="text-slate-500">GST ({detail.gst_rate}%)</span>
                        <span className="font-medium text-slate-700 tabular-nums">{formatCurrency(detail.gst_amount)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-8 text-sm pt-1.5 border-t border-slate-200">
                      <span className="font-semibold text-slate-800">Total</span>
                      <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(detail.total)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {detail.notes && (
                <div className="mt-6">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Notes</p>
                  <p className="text-sm text-slate-600">{detail.notes}</p>
                </div>
              )}
            </div>
          </>
        ) : null}

        {/* Actions */}
        <div className="px-6 pb-6 pt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={onDownloadPdf}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 text-sm font-semibold rounded-xl hover:bg-indigo-100 active:scale-[0.98] transition-all"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
          {invoice.status === 'draft' && (
            <button
              onClick={onMarkSent}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-sm shadow-indigo-500/25"
            >
              <Send className="w-4 h-4" />
              Mark as Sent
            </button>
          )}
          {(invoice.status === 'sent' || invoice.status === 'overdue') && (
            <button
              onClick={onMarkPaid}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-sm"
            >
              <CheckCircle className="w-4 h-4" />
              Mark as Paid
            </button>
          )}
          {invoice.status === 'draft' && (
            <button
              onClick={onDelete}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-100 active:scale-[0.98] transition-all ml-auto"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function Invoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<InvoiceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Load invoices whenever filter changes
  useEffect(() => {
    loadInvoices();
  }, [filter]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const result = await invoiceAPI.list(params);
      setInvoices(result.invoices ?? result);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async (invoice: Invoice) => {
    try {
      const blob = await invoiceAPI.downloadPdf(invoice.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      // silently fail
    }
  };

  const handleMarkPaid = async (invoice: Invoice) => {
    await invoiceAPI.updateStatus(invoice.id, 'paid');
    loadInvoices();
    setSelectedInvoice(null);
    setInvoiceDetail(null);
  };

  const handleMarkSent = async (invoice: Invoice) => {
    await invoiceAPI.updateStatus(invoice.id, 'sent');
    loadInvoices();
    setSelectedInvoice(null);
    setInvoiceDetail(null);
  };

  const handleDelete = async (invoice: Invoice) => {
    if (!confirm(`Delete invoice "${invoice.invoice_number}"?`)) return;
    await invoiceAPI.delete(invoice.id);
    loadInvoices();
    setSelectedInvoice(null);
    setInvoiceDetail(null);
  };

  const handleViewDetail = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setInvoiceDetail(null);
    setDetailLoading(true);
    try {
      const detail = await invoiceAPI.get(invoice.id);
      setInvoiceDetail(detail);
    } catch {
      // keep modal open with no detail
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedInvoice(null);
    setInvoiceDetail(null);
  };

  // Client-side search filtering
  const filteredInvoices = invoices.filter((inv) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.invoice_number.toLowerCase().includes(q) ||
      inv.customer_name.toLowerCase().includes(q)
    );
  });

  // Stats
  const totalInvoices = invoices.length;
  const outstanding = invoices
    .filter((inv) => inv.status === 'sent' || inv.status === 'overdue')
    .reduce((sum, inv) => sum + inv.total, 0);
  const paidTotal = invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.total, 0);
  const overdueCount = invoices.filter((inv) => inv.status === 'overdue').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create and manage customer invoices
          </p>
        </div>
        <button
          onClick={() => navigate('/invoices/new')}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-sm shadow-indigo-500/25"
        >
          <Plus className="w-4 h-4" />
          New Invoice
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
          placeholder="Search invoices..."
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Invoices</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalInvoices}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Outstanding</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{formatCurrency(outstanding)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Paid</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(paidTotal)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Overdue</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{overdueCount}</p>
        </div>
      </div>

      {/* Invoice List */}
      {loading ? (
        <LoadingState />
      ) : filteredInvoices.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="min-w-full">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Invoice #
                  </th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Customer
                  </th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Date
                  </th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Due Date
                  </th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Amount
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
                {filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="group hover:bg-slate-50/80 cursor-pointer transition-colors border-b border-slate-100 last:border-b-0"
                    onClick={() => handleViewDetail(inv)}
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-slate-800">{inv.invoice_number}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-slate-700">{inv.customer_name}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-600">{formatDate(inv.invoice_date)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-600">{formatDate(inv.due_date)}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-sm font-semibold text-slate-800 tabular-nums">
                        {formatCurrency(inv.total)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleViewDetail(inv)}
                          title="View details"
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadPdf(inv)}
                          title="Download PDF"
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {(inv.status === 'sent' || inv.status === 'overdue') && (
                          <button
                            onClick={() => handleMarkPaid(inv)}
                            title="Mark as paid"
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-all"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {inv.status === 'draft' && (
                          <button
                            onClick={() => handleDelete(inv)}
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
            {filteredInvoices.map((inv) => (
              <div
                key={inv.id}
                className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
                onClick={() => handleViewDetail(inv)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{inv.invoice_number}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{inv.customer_name}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-800 tabular-nums flex-shrink-0">
                    {formatCurrency(inv.total)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>Due {formatDate(inv.due_date)}</span>
                  </div>
                  <StatusBadge status={inv.status} />
                </div>
              </div>
            ))}
          </div>

          {/* Result count */}
          <p className="text-xs text-slate-400 text-center">
            Showing {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}
            {searchQuery ? ` matching "${searchQuery}"` : ''}
          </p>
        </>
      )}

      {/* Detail Modal */}
      {selectedInvoice && (
        <DetailModal
          invoice={selectedInvoice}
          detail={invoiceDetail}
          detailLoading={detailLoading}
          onClose={handleCloseModal}
          onDownloadPdf={() => handleDownloadPdf(selectedInvoice)}
          onMarkSent={() => handleMarkSent(selectedInvoice)}
          onMarkPaid={() => handleMarkPaid(selectedInvoice)}
          onDelete={() => handleDelete(selectedInvoice)}
        />
      )}
    </div>
  );
}
