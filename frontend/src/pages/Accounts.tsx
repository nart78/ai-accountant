import { useEffect, useState } from 'react';
import { accountAPI } from '../services/api';
import {
  Plus,
  Loader2,
  ChevronDown,
  ChevronRight,
  X,
  Pencil,
  Shield,
  Sprout,
  BookOpen,
  AlertCircle,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Landmark,
  Wallet,
  PiggyBank,
  ToggleLeft,
  ToggleRight,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Account {
  id: number;
  code: string;
  name: string;
  account_type: AccountType;
  sub_type: string | null;
  description: string | null;
  parent_account_id: number | null;
  is_active: boolean;
  is_system: boolean;
  tax_code: string | null;
  normal_balance: string | null;
  balance: number;
}

interface LedgerEntry {
  id: number;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  reference: string | null;
}

interface LedgerResponse {
  account: Account;
  total: number;
  entries: LedgerEntry[];
}

type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

interface AccountFormData {
  code: string;
  name: string;
  account_type: AccountType;
  sub_type: string;
  description: string;
  tax_code: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCOUNT_TYPE_ORDER: AccountType[] = [
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense',
];

const ACCOUNT_TYPE_CONFIG: Record<
  AccountType,
  {
    label: string;
    pluralLabel: string;
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    borderColor: string;
    headerBg: string;
    balanceColor: string;
  }
> = {
  asset: {
    label: 'Asset',
    pluralLabel: 'Assets',
    icon: Wallet,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    borderColor: 'border-l-blue-500',
    headerBg: 'bg-blue-50/50',
    balanceColor: 'text-blue-700',
  },
  liability: {
    label: 'Liability',
    pluralLabel: 'Liabilities',
    icon: Landmark,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    borderColor: 'border-l-amber-500',
    headerBg: 'bg-amber-50/50',
    balanceColor: 'text-amber-700',
  },
  equity: {
    label: 'Equity',
    pluralLabel: 'Equity',
    icon: PiggyBank,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    borderColor: 'border-l-purple-500',
    headerBg: 'bg-purple-50/50',
    balanceColor: 'text-purple-700',
  },
  revenue: {
    label: 'Revenue',
    pluralLabel: 'Revenue',
    icon: TrendingUp,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    borderColor: 'border-l-emerald-500',
    headerBg: 'bg-emerald-50/50',
    balanceColor: 'text-emerald-700',
  },
  expense: {
    label: 'Expense',
    pluralLabel: 'Expenses',
    icon: TrendingDown,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
    borderColor: 'border-l-red-500',
    headerBg: 'bg-red-50/50',
    balanceColor: 'text-red-700',
  },
};

const EMPTY_FORM: AccountFormData = {
  code: '',
  name: '',
  account_type: 'asset',
  sub_type: '',
  description: '',
  tax_code: '',
};

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

function groupAccountsByType(accounts: Account[]): Record<AccountType, Account[]> {
  const groups: Record<AccountType, Account[]> = {
    asset: [],
    liability: [],
    equity: [],
    revenue: [],
    expense: [],
  };
  for (const account of accounts) {
    if (groups[account.account_type]) {
      groups[account.account_type].push(account);
    }
  }
  // Sort each group by code
  for (const type of ACCOUNT_TYPE_ORDER) {
    groups[type].sort((a, b) => a.code.localeCompare(b.code));
  }
  return groups;
}

function sumBalances(accounts: Account[]): number {
  return accounts.reduce((sum, a) => sum + (a.balance ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
      <p className="text-sm font-medium text-slate-400">Loading accounts...</p>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
      <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-amber-800">Error</p>
        <p className="text-sm text-amber-700 mt-0.5">{message}</p>
      </div>
    </div>
  );
}

function SuccessBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
      <Sprout className="w-5 h-5 text-emerald-500 flex-shrink-0" />
      <p className="text-sm font-medium text-emerald-800 flex-1">{message}</p>
      <button
        onClick={onDismiss}
        className="p-1 rounded-lg hover:bg-emerald-100 text-emerald-400 hover:text-emerald-600 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full ${
        isActive
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-slate-100 text-slate-500'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isActive ? 'bg-emerald-500' : 'bg-slate-400'
        }`}
      />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

function SystemBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-indigo-50 text-indigo-600">
      <Shield className="w-2.5 h-2.5" />
      System
    </span>
  );
}

// ---------------------------------------------------------------------------
// Empty State (no accounts at all)
// ---------------------------------------------------------------------------

function EmptyState({ onSeed, seeding }: { onSeed: () => void; seeding: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <BookOpen className="w-8 h-8 text-slate-300" />
      </div>
      <p className="text-base font-semibold text-slate-500">No accounts found</p>
      <p className="text-sm text-slate-400 mt-1 text-center max-w-sm">
        Get started by seeding default Canadian chart of accounts or create your own.
      </p>
      <button
        onClick={onSeed}
        disabled={seeding}
        className="mt-6 inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {seeding ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Seeding...
          </>
        ) : (
          <>
            <Sprout className="w-4 h-4" />
            Seed Default Accounts
          </>
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account Form Modal (Add / Edit)
// ---------------------------------------------------------------------------

function AccountFormModal({
  mode,
  initial,
  saving,
  onSave,
  onClose,
}: {
  mode: 'add' | 'edit';
  initial: AccountFormData;
  saving: boolean;
  onSave: (data: AccountFormData) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<AccountFormData>(initial);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  const updateField = <K extends keyof AccountFormData>(key: K, value: AccountFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const inputClass =
    'w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all placeholder:text-slate-400';
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              {mode === 'add' ? (
                <Plus className="w-5 h-5 text-indigo-500" />
              ) : (
                <Pencil className="w-5 h-5 text-indigo-500" />
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {mode === 'add' ? 'Add Account' : 'Edit Account'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Code */}
            <div>
              <label className={labelClass}>Account Code</label>
              <input
                type="text"
                required
                value={form.code}
                onChange={(e) => updateField('code', e.target.value)}
                placeholder="e.g. 1000"
                className={inputClass}
              />
            </div>

            {/* Account Type */}
            <div>
              <label className={labelClass}>Account Type</label>
              <select
                value={form.account_type}
                onChange={(e) => updateField('account_type', e.target.value as AccountType)}
                className={inputClass}
              >
                {ACCOUNT_TYPE_ORDER.map((type) => (
                  <option key={type} value={type}>
                    {ACCOUNT_TYPE_CONFIG[type].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className={labelClass}>Account Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. Cash"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Sub Type */}
            <div>
              <label className={labelClass}>Sub Type</label>
              <input
                type="text"
                value={form.sub_type}
                onChange={(e) => updateField('sub_type', e.target.value)}
                placeholder="e.g. Current Asset"
                className={inputClass}
              />
            </div>

            {/* Tax Code */}
            <div>
              <label className={labelClass}>Tax Code</label>
              <input
                type="text"
                value={form.tax_code}
                onChange={(e) => updateField('tax_code', e.target.value)}
                placeholder="e.g. GST, HST"
                className={inputClass}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Optional description of this account"
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 active:scale-[0.98] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.code.trim() || !form.name.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : mode === 'add' ? (
                <>
                  <Plus className="w-4 h-4" />
                  Add Account
                </>
              ) : (
                <>
                  <Pencil className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account Detail / Ledger Modal
// ---------------------------------------------------------------------------

function AccountDetailModal({
  account,
  onClose,
  onEdit,
  onToggleActive,
  togglingActive,
}: {
  account: Account;
  onClose: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  togglingActive: boolean;
}) {
  const [ledger, setLedger] = useState<LedgerResponse | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(true);

  const config = ACCOUNT_TYPE_CONFIG[account.account_type];

  useEffect(() => {
    setLoadingLedger(true);
    accountAPI
      .ledger(account.id, { limit: 20 })
      .then((data: LedgerResponse) => setLedger(data))
      .catch(() => setLedger(null))
      .finally(() => setLoadingLedger(false));
  }, [account.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-xl ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
                <config.icon className={`w-5 h-5 ${config.iconColor}`} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    {account.code}
                  </span>
                  {account.is_system && <SystemBadge />}
                  <ActiveBadge isActive={account.is_active} />
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-1 truncate">{account.name}</h2>
                {account.description && (
                  <p className="text-sm text-slate-500 mt-0.5">{account.description}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Account info row */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Type</p>
              <p className="text-sm font-medium text-slate-800 capitalize mt-0.5">{account.account_type}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Sub Type</p>
              <p className="text-sm font-medium text-slate-800 capitalize mt-0.5">
                {account.sub_type ?? '\u2014'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Tax Code</p>
              <p className="text-sm font-medium text-slate-800 mt-0.5">
                {account.tax_code ?? '\u2014'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Balance</p>
              <p className={`text-sm font-bold tabular-nums mt-0.5 ${
                account.balance >= 0 ? 'text-emerald-700' : 'text-red-600'
              }`}>
                {formatCurrency(account.balance)}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {!account.is_system && (
              <button
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 rounded-xl hover:bg-indigo-100 active:scale-[0.98] transition-all"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            )}
            <button
              onClick={onToggleActive}
              disabled={togglingActive}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl active:scale-[0.98] transition-all disabled:opacity-60 ${
                account.is_active
                  ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
              }`}
            >
              {togglingActive ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : account.is_active ? (
                <ToggleLeft className="w-3.5 h-3.5" />
              ) : (
                <ToggleRight className="w-3.5 h-3.5" />
              )}
              {account.is_active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </div>

        {/* Ledger entries */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-semibold text-slate-700">Ledger Entries</h3>
          </div>

          {loadingLedger ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          ) : !ledger || ledger.entries.length === 0 ? (
            <div className="py-12 text-center">
              <DollarSign className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No ledger entries yet</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Date
                      </th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Description
                      </th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Debit
                      </th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Credit
                      </th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {ledger.entries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3 text-sm text-slate-600 tabular-nums whitespace-nowrap">
                          {formatDate(entry.date)}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-800 font-medium">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[200px]">{entry.description}</span>
                            {entry.reference && (
                              <span className="text-xs text-slate-400 font-normal">
                                #{entry.reference}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-sm text-right tabular-nums">
                          {entry.debit > 0 ? (
                            <span className="text-slate-800 font-medium">{formatCurrency(entry.debit)}</span>
                          ) : (
                            <span className="text-slate-300">&mdash;</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm text-right tabular-nums">
                          {entry.credit > 0 ? (
                            <span className="text-slate-800 font-medium">{formatCurrency(entry.credit)}</span>
                          ) : (
                            <span className="text-slate-300">&mdash;</span>
                          )}
                        </td>
                        <td className={`px-5 py-3 text-sm text-right font-semibold tabular-nums ${
                          entry.balance >= 0 ? 'text-emerald-700' : 'text-red-600'
                        }`}>
                          {formatCurrency(entry.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile ledger cards */}
              <div className="sm:hidden divide-y divide-slate-100">
                {ledger.entries.map((entry) => (
                  <div key={entry.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{entry.description}</p>
                        <p className="text-xs text-slate-400 mt-0.5 tabular-nums">{formatDate(entry.date)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {entry.debit > 0 && (
                          <div className="flex items-center gap-1 text-sm font-medium text-slate-800">
                            <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                            {formatCurrency(entry.debit)}
                          </div>
                        )}
                        {entry.credit > 0 && (
                          <div className="flex items-center gap-1 text-sm font-medium text-slate-800">
                            <ArrowDownRight className="w-3 h-3 text-red-500" />
                            {formatCurrency(entry.credit)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 text-right">
                      <span className={`text-xs font-semibold tabular-nums ${
                        entry.balance >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}>
                        Bal: {formatCurrency(entry.balance)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {ledger.total > ledger.entries.length && (
                <div className="px-6 py-3 border-t border-slate-100 text-center">
                  <p className="text-xs text-slate-400">
                    Showing {ledger.entries.length} of {ledger.total} entries
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account Table Row (Desktop)
// ---------------------------------------------------------------------------

function AccountRow({
  account,
  onSelect,
  onEdit,
  onToggleActive,
}: {
  account: Account;
  onSelect: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
}) {
  return (
    <tr
      className="group hover:bg-slate-50/80 cursor-pointer transition-colors border-b border-slate-100 last:border-b-0"
      onClick={onSelect}
    >
      <td className="px-5 py-3.5">
        <span className="text-sm font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
          {account.code}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">{account.name}</span>
          {account.is_system && <SystemBadge />}
        </div>
      </td>
      <td className="px-5 py-3.5">
        <span className="text-sm text-slate-500 capitalize">
          {account.sub_type ?? '\u2014'}
        </span>
      </td>
      <td className="px-5 py-3.5 text-right">
        <span
          className={`text-sm font-semibold tabular-nums ${
            account.balance >= 0 ? 'text-emerald-700' : 'text-red-600'
          }`}
        >
          {formatCurrency(account.balance)}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <ActiveBadge isActive={account.is_active} />
      </td>
      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!account.is_system && (
            <button
              onClick={onEdit}
              title="Edit account"
              className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onToggleActive}
            title={account.is_active ? 'Deactivate' : 'Activate'}
            className={`p-1.5 rounded-lg transition-colors ${
              account.is_active
                ? 'text-amber-600 hover:bg-amber-50'
                : 'text-emerald-600 hover:bg-emerald-50'
            }`}
          >
            {account.is_active ? (
              <ToggleLeft className="w-4 h-4" />
            ) : (
              <ToggleRight className="w-4 h-4" />
            )}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Account Card (Mobile)
// ---------------------------------------------------------------------------

function AccountCard({
  account,
  onSelect,
  onEdit,
  onToggleActive,
}: {
  account: Account;
  onSelect: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
}) {
  return (
    <div
      className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
              {account.code}
            </span>
            {account.is_system && <SystemBadge />}
            <ActiveBadge isActive={account.is_active} />
          </div>
          <p className="text-sm font-semibold text-slate-800 mt-1.5 truncate">{account.name}</p>
          {account.sub_type && (
            <p className="text-xs text-slate-400 mt-0.5 capitalize">{account.sub_type}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p
            className={`text-sm font-bold tabular-nums ${
              account.balance >= 0 ? 'text-emerald-700' : 'text-red-600'
            }`}
          >
            {formatCurrency(account.balance)}
          </p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {!account.is_system && (
          <button
            onClick={onEdit}
            className="flex items-center gap-1 text-xs font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        )}
        <button
          onClick={onToggleActive}
          className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ml-auto ${
            account.is_active
              ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
              : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
          }`}
        >
          {account.is_active ? (
            <>
              <ToggleLeft className="w-3.5 h-3.5" />
              Deactivate
            </>
          ) : (
            <>
              <ToggleRight className="w-3.5 h-3.5" />
              Activate
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible Account Group Section
// ---------------------------------------------------------------------------

function AccountGroupSection({
  type,
  accounts,
  expanded,
  onToggle,
  onSelectAccount,
  onEditAccount,
  onToggleAccountActive,
}: {
  type: AccountType;
  accounts: Account[];
  expanded: boolean;
  onToggle: () => void;
  onSelectAccount: (account: Account) => void;
  onEditAccount: (account: Account) => void;
  onToggleAccountActive: (account: Account) => void;
}) {
  const config = ACCOUNT_TYPE_CONFIG[type];
  const Icon = config.icon;
  const total = sumBalances(accounts);

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-100 border-l-4 ${config.borderColor} overflow-hidden`}>
      {/* Section Header */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-5 py-4 ${config.headerBg} hover:bg-opacity-80 transition-colors`}
      >
        <div className={`w-9 h-9 rounded-lg ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${config.iconColor}`} />
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">{config.pluralLabel}</h3>
            <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {accounts.length}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={`text-sm font-bold tabular-nums ${config.balanceColor}`}>
            {formatCurrency(total)}
          </span>
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Table (Desktop) */}
      {expanded && accounts.length > 0 && (
        <>
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Code
                  </th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Name
                  </th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Sub Type
                  </th>
                  <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Balance
                  </th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Status
                  </th>
                  <th className="px-5 py-2.5 w-24">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <AccountRow
                    key={account.id}
                    account={account}
                    onSelect={() => onSelectAccount(account)}
                    onEdit={() => onEditAccount(account)}
                    onToggleActive={() => onToggleAccountActive(account)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards (Mobile) */}
          <div className="lg:hidden p-4 space-y-3">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onSelect={() => onSelectAccount(account)}
                onEdit={() => onEditAccount(account)}
                onToggleActive={() => onToggleAccountActive(account)}
              />
            ))}
          </div>
        </>
      )}

      {expanded && accounts.length === 0 && (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-slate-400">No {config.pluralLabel.toLowerCase()} accounts</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal states
  const [formModal, setFormModal] = useState<{ mode: 'add' | 'edit'; account?: Account } | null>(null);
  const [detailAccount, setDetailAccount] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  // Collapsible section state - all expanded by default
  const [expandedSections, setExpandedSections] = useState<Record<AccountType, boolean>>({
    asset: true,
    liability: true,
    equity: true,
    revenue: true,
    expense: true,
  });

  // -----------------------------------------------------------------------
  // Data loading
  // -----------------------------------------------------------------------

  const loadAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await accountAPI.list({ with_balances: true });
      setAccounts(result.accounts ?? []);
    } catch {
      setError('Could not load accounts. Make sure the backend is running.');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleSeed = async () => {
    setSeeding(true);
    setError(null);
    try {
      const result = await accountAPI.seed();
      setSuccess(result.message ?? `Created ${result.created ?? 0} default accounts.`);
      await loadAccounts();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Failed to seed accounts.');
    } finally {
      setSeeding(false);
    }
  };

  const handleSave = async (data: AccountFormData) => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        code: data.code.trim(),
        name: data.name.trim(),
        account_type: data.account_type,
        sub_type: data.sub_type.trim() || null,
        description: data.description.trim() || null,
        tax_code: data.tax_code.trim() || null,
      };

      if (formModal?.mode === 'edit' && formModal.account) {
        await accountAPI.update(formModal.account.id, payload);
        setSuccess('Account updated successfully.');
      } else {
        await accountAPI.create(payload);
        setSuccess('Account created successfully.');
      }

      setFormModal(null);
      await loadAccounts();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Failed to save account.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (account: Account) => {
    setTogglingActive(true);
    setError(null);
    try {
      await accountAPI.update(account.id, { is_active: !account.is_active });
      setSuccess(`Account "${account.name}" ${account.is_active ? 'deactivated' : 'activated'}.`);
      await loadAccounts();
      // Update detail modal if open
      if (detailAccount?.id === account.id) {
        setDetailAccount({ ...account, is_active: !account.is_active });
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Failed to update account status.');
    } finally {
      setTogglingActive(false);
    }
  };

  const handleEditFromDetail = () => {
    if (detailAccount) {
      setDetailAccount(null);
      setFormModal({ mode: 'edit', account: detailAccount });
    }
  };

  const toggleSection = (type: AccountType) => {
    setExpandedSections((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------

  const grouped = groupAccountsByType(accounts);
  const hasAccounts = accounts.length > 0;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Chart of Accounts</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your accounts for double-entry bookkeeping
          </p>
        </div>
        <button
          onClick={() => setFormModal({ mode: 'add' })}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </button>
      </div>

      {/* Banners */}
      {error && <ErrorBanner message={error} />}
      {success && <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />}

      {/* Main Content */}
      {loading ? (
        <LoadingState />
      ) : !hasAccounts ? (
        <EmptyState onSeed={handleSeed} seeding={seeding} />
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {ACCOUNT_TYPE_ORDER.map((type) => {
              const config = ACCOUNT_TYPE_CONFIG[type];
              const Icon = config.icon;
              const total = sumBalances(grouped[type]);
              const count = grouped[type].length;
              return (
                <div
                  key={type}
                  className={`bg-white rounded-xl shadow-sm border border-slate-100 border-l-4 ${config.borderColor} p-4 hover:shadow-md transition-shadow cursor-pointer`}
                  onClick={() => {
                    setExpandedSections((_prev) => {
                      // Collapse all, expand target
                      const next: Record<AccountType, boolean> = {
                        asset: false,
                        liability: false,
                        equity: false,
                        revenue: false,
                        expense: false,
                      };
                      next[type] = true;
                      return next;
                    });
                    // Scroll to section
                    const el = document.getElementById(`section-${type}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-7 h-7 rounded-lg ${config.iconBg} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${config.iconColor}`} />
                    </div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {config.pluralLabel}
                    </span>
                  </div>
                  <p className={`text-lg font-bold tabular-nums ${config.balanceColor}`}>
                    {formatCurrency(total)}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {count} account{count !== 1 ? 's' : ''}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Account Groups */}
          {ACCOUNT_TYPE_ORDER.map((type) => (
            <div key={type} id={`section-${type}`}>
              <AccountGroupSection
                type={type}
                accounts={grouped[type]}
                expanded={expandedSections[type]}
                onToggle={() => toggleSection(type)}
                onSelectAccount={(account) => setDetailAccount(account)}
                onEditAccount={(account) => setFormModal({ mode: 'edit', account })}
                onToggleAccountActive={handleToggleActive}
              />
            </div>
          ))}

          {/* Footer count */}
          <p className="text-xs text-slate-400 text-center">
            {accounts.length} account{accounts.length !== 1 ? 's' : ''} total
          </p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {formModal && (
        <AccountFormModal
          mode={formModal.mode}
          initial={
            formModal.mode === 'edit' && formModal.account
              ? {
                  code: formModal.account.code,
                  name: formModal.account.name,
                  account_type: formModal.account.account_type,
                  sub_type: formModal.account.sub_type ?? '',
                  description: formModal.account.description ?? '',
                  tax_code: formModal.account.tax_code ?? '',
                }
              : EMPTY_FORM
          }
          saving={saving}
          onSave={handleSave}
          onClose={() => setFormModal(null)}
        />
      )}

      {/* Detail / Ledger Modal */}
      {detailAccount && (
        <AccountDetailModal
          account={detailAccount}
          onClose={() => setDetailAccount(null)}
          onEdit={handleEditFromDetail}
          onToggleActive={() => handleToggleActive(detailAccount)}
          togglingActive={togglingActive}
        />
      )}
    </div>
  );
}
