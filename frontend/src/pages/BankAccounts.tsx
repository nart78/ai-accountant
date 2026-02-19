import { useState, useEffect, useRef } from 'react';
import { bankAccountAPI } from '../services/api';
import {
  Landmark,
  Plus,
  Upload,
  ArrowLeft,
  Check,
  X,
  Loader2,
  Pencil,
  CreditCard,
  Building2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BankAccount {
  id: number;
  name: string;
  institution: string;
  account_number_last4: string;
  account_type: 'chequing' | 'savings' | 'credit_card';
  currency: string;
  opening_balance: number;
  current_balance: number;
  is_active: boolean;
  gl_account_name: string;
  created_at: string;
}

interface Transaction {
  id: number;
  transaction_date: string;
  description: string;
  amount: number;
  balance: number;
  reference: string | null;
  is_reconciled: boolean;
  journal_entry_id: number | null;
}

interface ImportResult {
  imported: number;
  skipped: number;
  total_in_file: number;
  new_balance: number;
  message: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  chequing: 'Chequing',
  savings: 'Savings',
  credit_card: 'Credit Card',
};

const ACCOUNT_TYPE_ICONS: Record<string, typeof Landmark> = {
  chequing: Building2,
  savings: Landmark,
  credit_card: CreditCard,
};

const PAGE_SIZE = 25;

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

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border bg-emerald-50 border-emerald-200 text-emerald-700">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border bg-slate-50 border-slate-200 text-slate-500">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      Inactive
    </span>
  );
}

function ReconciledBadge({ reconciled }: { reconciled: boolean }) {
  return reconciled ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
      <Check className="w-3 h-3" />
      Reconciled
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200">
      <X className="w-3 h-3" />
      Unreconciled
    </span>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
      <p className="text-sm font-medium text-slate-400">{label}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Landmark className="w-8 h-8 text-slate-300" />
      </div>
      <p className="text-base font-semibold text-slate-500">No bank accounts yet</p>
      <p className="text-sm text-slate-400 mt-1">Add a bank account to get started</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add / Edit Modal
// ---------------------------------------------------------------------------

function AccountModal({
  account,
  onClose,
  onSave,
}: {
  account: BankAccount | null; // null = create mode
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    name: account?.name ?? '',
    institution: account?.institution ?? '',
    account_number_last4: account?.account_number_last4 ?? '',
    account_type: account?.account_type ?? 'chequing',
    opening_balance: account?.opening_balance?.toString() ?? '0',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        institution: form.institution.trim(),
        account_number_last4: form.account_number_last4.trim(),
        account_type: form.account_type,
        opening_balance: parseFloat(form.opening_balance) || 0,
      };
      if (account) {
        await bankAccountAPI.update(account.id, payload);
      } else {
        await bankAccountAPI.create(payload);
      }
      onSave();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to save account');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Landmark className="w-5 h-5 text-indigo-500" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                {account ? 'Edit Account' : 'Add Account'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Account Name *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g. TD Business Chequing"
              className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Institution *
            </label>
            <input
              type="text"
              required
              value={form.institution}
              onChange={(e) => handleChange('institution', e.target.value)}
              placeholder="e.g. TD, RBC, Scotiabank"
              className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Last 4 Digits
              </label>
              <input
                type="text"
                maxLength={4}
                value={form.account_number_last4}
                onChange={(e) =>
                  handleChange(
                    'account_number_last4',
                    e.target.value.replace(/\D/g, '').slice(0, 4)
                  )
                }
                placeholder="1234"
                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all placeholder:text-slate-400 tabular-nums"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Account Type *
              </label>
              <select
                required
                value={form.account_type}
                onChange={(e) => handleChange('account_type', e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
              >
                <option value="chequing">Chequing</option>
                <option value="savings">Savings</option>
                <option value="credit_card">Credit Card</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Opening Balance
            </label>
            <input
              type="number"
              step="0.01"
              value={form.opening_balance}
              onChange={(e) => handleChange('opening_balance', e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all placeholder:text-slate-400 tabular-nums"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 active:scale-[0.98] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-sm shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {account ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account Detail View
// ---------------------------------------------------------------------------

function AccountDetail({
  account,
  onBack,
  onEdit,
  onRefreshAccounts,
}: {
  account: BankAccount;
  onBack: () => void;
  onEdit: (account: BankAccount) => void;
  onRefreshAccounts: () => void;
}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState('');
  const [reconciledFilter, setReconciledFilter] = useState<'all' | 'reconciled' | 'unreconciled'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentBalance, setCurrentBalance] = useState(account.current_balance);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTransactions();
  }, [account.id, page]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const result = await bankAccountAPI.transactions(account.id, {
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      setTransactions(result.transactions ?? []);
      setTotalTransactions(result.total ?? 0);
    } catch {
      setTransactions([]);
      setTotalTransactions(0);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    setImportError('');
    try {
      const result = await bankAccountAPI.importCsv(account.id, file);
      setImportResult(result);
      setCurrentBalance(result.new_balance);
      setPage(0);
      loadTransactions();
      onRefreshAccounts();
    } catch (err: any) {
      setImportError(err?.response?.data?.detail || 'Failed to import CSV');
    } finally {
      setImporting(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Client-side filtering (date range + reconciled status)
  const filteredTransactions = transactions.filter((txn) => {
    if (reconciledFilter === 'reconciled' && !txn.is_reconciled) return false;
    if (reconciledFilter === 'unreconciled' && txn.is_reconciled) return false;
    if (dateFrom && txn.transaction_date < dateFrom) return false;
    if (dateTo && txn.transaction_date > dateTo) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(totalTransactions / PAGE_SIZE));
  const IconComponent = ACCOUNT_TYPE_ICONS[account.account_type] || Landmark;

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to accounts
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
              <IconComponent className="w-6 h-6 text-indigo-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {account.name}
              </h1>
              <p className="text-sm text-slate-500">
                {account.institution}
                {account.account_number_last4 && ` ****${account.account_number_last4}`}
                {' · '}
                {ACCOUNT_TYPE_LABELS[account.account_type] || account.account_type}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Balance
              </p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                {formatCurrency(currentBalance)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => onEdit(account)}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-200 active:scale-[0.98] transition-all"
        >
          <Pencil className="w-4 h-4" />
          Edit Account
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleImport}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-sm shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {importing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          Import CSV
        </button>

        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border transition-all ml-auto ${
            showFilters
              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
              : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Import Result Banner */}
      {importResult && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              Import Complete
            </p>
            <p className="text-sm text-emerald-700 mt-0.5">
              {importResult.imported} imported, {importResult.skipped} skipped out of{' '}
              {importResult.total_in_file} rows. New balance:{' '}
              {formatCurrency(importResult.new_balance)}
            </p>
          </div>
          <button
            onClick={() => setImportResult(null)}
            className="p-1 rounded-lg hover:bg-emerald-100 text-emerald-600 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {importError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start justify-between gap-3">
          <p className="text-sm text-red-700">{importError}</p>
          <button
            onClick={() => setImportError('')}
            className="p-1 rounded-lg hover:bg-red-100 text-red-600 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Status
            </label>
            <select
              value={reconciledFilter}
              onChange={(e) =>
                setReconciledFilter(e.target.value as 'all' | 'reconciled' | 'unreconciled')
              }
              className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
            >
              <option value="all">All</option>
              <option value="reconciled">Reconciled</option>
              <option value="unreconciled">Unreconciled</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
            />
          </div>
          {(reconciledFilter !== 'all' || dateFrom || dateTo) && (
            <button
              onClick={() => {
                setReconciledFilter('all');
                setDateFrom('');
                setDateTo('');
              }}
              className="px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Transactions */}
      {loading ? (
        <LoadingState label="Loading transactions..." />
      ) : filteredTransactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <Landmark className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-base font-semibold text-slate-500">No transactions yet</p>
          <p className="text-sm text-slate-400 mt-1">Import a CSV to add transactions</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="min-w-full">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Date
                  </th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Description
                  </th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Amount
                  </th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Balance
                  </th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((txn) => (
                  <tr
                    key={txn.id}
                    className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-b-0"
                  >
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-600">
                        {formatDate(txn.transaction_date)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-slate-800 truncate max-w-xs">
                        {txn.description}
                      </p>
                      {txn.reference && (
                        <p className="text-xs text-slate-400 mt-0.5">Ref: {txn.reference}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          txn.amount >= 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {txn.amount >= 0 ? '+' : ''}
                        {formatCurrency(txn.amount)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-sm text-slate-700 tabular-nums">
                        {formatCurrency(txn.balance)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <ReconciledBadge reconciled={txn.is_reconciled} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {filteredTransactions.map((txn) => (
              <div
                key={txn.id}
                className="bg-white rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {txn.description}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDate(txn.transaction_date)}
                      {txn.reference && ` · Ref: ${txn.reference}`}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold tabular-nums flex-shrink-0 ${
                      txn.amount >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {txn.amount >= 0 ? '+' : ''}
                    {formatCurrency(txn.amount)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-slate-500 tabular-nums">
                    Bal: {formatCurrency(txn.balance)}
                  </span>
                  <ReconciledBadge reconciled={txn.is_reconciled} />
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Showing {page * PAGE_SIZE + 1}–
                {Math.min((page + 1) * PAGE_SIZE, totalTransactions)} of{' '}
                {totalTransactions} transactions
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-slate-600 tabular-nums">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function BankAccounts() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [modalAccount, setModalAccount] = useState<BankAccount | null | undefined>(undefined);
  // undefined = modal closed, null = create mode, BankAccount = edit mode

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const result = await bankAccountAPI.list();
      setAccounts(result.accounts ?? result ?? []);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleModalSave = () => {
    setModalAccount(undefined);
    loadAccounts();
  };

  const handleSelectAccount = (account: BankAccount) => {
    setSelectedAccount(account);
  };

  const handleBackToList = () => {
    setSelectedAccount(null);
  };

  const handleEditFromDetail = (account: BankAccount) => {
    setModalAccount(account);
  };

  // Stats
  const totalAccounts = accounts.length;
  const totalBalance = accounts.reduce((sum, a) => sum + a.current_balance, 0);

  // ---------------------------------------------------------------------------
  // Account Detail View
  // ---------------------------------------------------------------------------
  if (selectedAccount) {
    return (
      <>
        <AccountDetail
          account={selectedAccount}
          onBack={handleBackToList}
          onEdit={handleEditFromDetail}
          onRefreshAccounts={loadAccounts}
        />
        {modalAccount !== undefined && (
          <AccountModal
            account={modalAccount}
            onClose={() => setModalAccount(undefined)}
            onSave={handleModalSave}
          />
        )}
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Account List View
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Bank Accounts</h1>
          <p className="text-sm text-slate-500 mt-1">
            Import bank statements and reconcile transactions
          </p>
        </div>
        <button
          onClick={() => setModalAccount(null)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-sm shadow-indigo-500/25"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Total Accounts
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalAccounts}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Total Balance
          </p>
          <p className="text-2xl font-bold text-indigo-600 mt-1 tabular-nums">
            {formatCurrency(totalBalance)}
          </p>
        </div>
      </div>

      {/* Account List */}
      {loading ? (
        <LoadingState label="Loading bank accounts..." />
      ) : accounts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {accounts.map((account) => {
            const IconComponent = ACCOUNT_TYPE_ICONS[account.account_type] || Landmark;
            return (
              <div
                key={account.id}
                onClick={() => handleSelectAccount(account)}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors">
                      <IconComponent className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {account.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {account.institution}
                        {account.account_number_last4 &&
                          ` ****${account.account_number_last4}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setModalAccount(account);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                    title="Edit account"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md bg-slate-100 text-slate-600">
                      {ACCOUNT_TYPE_LABELS[account.account_type] || account.account_type}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-slate-900 tabular-nums">
                      {formatCurrency(account.current_balance)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <ActiveBadge isActive={account.is_active} />
                  {account.gl_account_name && (
                    <span className="text-xs text-slate-400 truncate ml-2">
                      {account.gl_account_name}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalAccount !== undefined && (
        <AccountModal
          account={modalAccount}
          onClose={() => setModalAccount(undefined)}
          onSave={handleModalSave}
        />
      )}
    </div>
  );
}
