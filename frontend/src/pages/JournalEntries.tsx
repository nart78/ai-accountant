import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { journalEntryAPI, accountAPI } from '../services/api';
import {
  Plus,
  X,
  Loader2,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Trash2,
  CalendarDays,
  Filter,
  MinusCircle,
  PlusCircle,
  Check,
  AlertCircle,
  Search,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JournalLine {
  id: number;
  account_id: number;
  account_code: string;
  account_name: string;
  description: string;
  debit: number;
  credit: number;
}

interface JournalEntry {
  id: number;
  entry_date: string;
  description: string;
  reference: string;
  entry_type: string;
  transaction_id: number | null;
  invoice_id: number | null;
  is_posted: boolean;
  notes: string | null;
  total_debit: number;
  total_credit: number;
  created_at: string;
  lines: JournalLine[];
}

interface Account {
  id: number;
  code: string;
  name: string;
  account_type: string;
}

interface NewLine {
  account_id: number | null;
  description: string;
  debit: string;
  credit: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

const ENTRY_TYPES = [
  { key: '', label: 'All Types' },
  { key: 'manual', label: 'Manual' },
  { key: 'auto_expense', label: 'Auto-Expense' },
  { key: 'auto_revenue', label: 'Auto-Revenue' },
  { key: 'auto_invoice', label: 'Auto-Invoice' },
  { key: 'auto_payment', label: 'Auto-Payment' },
  { key: 'adjustment', label: 'Adjustment' },
] as const;

const TYPE_BADGE_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  manual: {
    bg: 'bg-indigo-50 border-indigo-200',
    text: 'text-indigo-700',
    dot: 'bg-indigo-500',
    label: 'Manual',
  },
  auto_expense: {
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    label: 'Auto-Expense',
  },
  auto_revenue: {
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'Auto-Revenue',
  },
  auto_invoice: {
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
    label: 'Auto-Invoice',
  },
  auto_payment: {
    bg: 'bg-teal-50 border-teal-200',
    text: 'text-teal-700',
    dot: 'bg-teal-500',
    label: 'Auto-Payment',
  },
  adjustment: {
    bg: 'bg-purple-50 border-purple-200',
    text: 'text-purple-700',
    dot: 'bg-purple-500',
    label: 'Adjustment',
  },
};

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

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function sourceLabel(entry: JournalEntry): string | null {
  if (entry.transaction_id) return `From TXN-${entry.transaction_id}`;
  if (entry.invoice_id) return `From INV-${entry.invoice_id}`;
  return null;
}

function parseAmount(val: string): number {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function emptyLine(): NewLine {
  return { account_id: null, description: '', debit: '', credit: '' };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TypeBadge({ entryType }: { entryType: string }) {
  const config = TYPE_BADGE_CONFIG[entryType] ?? {
    bg: 'bg-slate-50 border-slate-200',
    text: 'text-slate-600',
    dot: 'bg-slate-400',
    label: entryType,
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

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
      <p className="text-sm font-medium text-slate-400">Loading journal entries...</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <BookOpen className="w-8 h-8 text-slate-300" />
      </div>
      <p className="text-base font-semibold text-slate-500">No journal entries found</p>
      <p className="text-sm text-slate-400 mt-1">Create a new entry to get started</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account Search Dropdown
// ---------------------------------------------------------------------------

function AccountSelect({
  accounts,
  value,
  onChange,
}: {
  accounts: Account[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = accounts.find((a) => a.id === value);

  const filtered = useMemo(() => {
    if (!query.trim()) return accounts;
    const q = query.toLowerCase();
    return accounts.filter(
      (a) =>
        a.code.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.account_type.toLowerCase().includes(q)
    );
  }, [accounts, query]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setQuery('');
        }}
        className="w-full text-left px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all truncate"
      >
        {selected ? (
          <span>
            <span className="font-medium text-slate-700">{selected.code}</span>
            <span className="text-slate-400 ml-1.5">{selected.name}</span>
          </span>
        ) : (
          <span className="text-slate-400">Select account...</span>
        )}
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search accounts..."
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 placeholder:text-slate-400"
                autoFocus
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No accounts found</p>
            ) : (
              filtered.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    onChange(a.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors flex items-center gap-2 ${
                    a.id === value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                  }`}
                >
                  <span className="font-medium tabular-nums w-12 flex-shrink-0">{a.code}</span>
                  <span className="truncate">{a.name}</span>
                  <span className="ml-auto text-xs text-slate-400 flex-shrink-0 capitalize">
                    {a.account_type.replace(/_/g, ' ')}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail Modal
// ---------------------------------------------------------------------------

function DetailModal({
  entry,
  onClose,
  onDelete,
}: {
  entry: JournalEntry;
  onClose: () => void;
  onDelete: () => void;
}) {
  const source = sourceLabel(entry);
  const isManual = entry.entry_type === 'manual';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900 truncate">
                  {entry.description || 'Journal Entry'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatDate(entry.entry_date)}
                  {entry.reference && (
                    <span className="ml-2 text-slate-300">|</span>
                  )}
                  {entry.reference && (
                    <span className="ml-2">Ref: {entry.reference}</span>
                  )}
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
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <TypeBadge entryType={entry.entry_type} />
            {entry.is_posted && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border bg-emerald-50 border-emerald-200 text-emerald-700">
                <Check className="w-3 h-3" />
                Posted
              </span>
            )}
            {source && (
              <span className="text-xs text-slate-400 italic ml-1">{source}</span>
            )}
          </div>
        </div>

        {/* Entry Info */}
        <div className="px-6 py-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Date
              </p>
              <p className="text-sm font-medium text-slate-800">{formatDate(entry.entry_date)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Reference
              </p>
              <p className="text-sm font-medium text-slate-800">{entry.reference || '\u2014'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Total Debit
              </p>
              <p className="text-sm font-semibold text-slate-800 tabular-nums">
                {formatCurrency(entry.total_debit)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Total Credit
              </p>
              <p className="text-sm font-semibold text-slate-800 tabular-nums">
                {formatCurrency(entry.total_credit)}
              </p>
            </div>
          </div>

          {entry.notes && (
            <div className="mt-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Notes
              </p>
              <p className="text-sm text-slate-600">{entry.notes}</p>
            </div>
          )}

          {/* Lines Table */}
          {entry.lines && entry.lines.length > 0 && (
            <div className="mt-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Lines
              </p>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-slate-50/80">
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Account Code
                        </th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Account Name
                        </th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Description
                        </th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Debit
                        </th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Credit
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.lines.map((line) => (
                        <tr key={line.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-sm font-medium text-slate-700 tabular-nums">
                            {line.account_code}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700">{line.account_name}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {line.description || '\u2014'}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700 text-right tabular-nums">
                            {line.debit > 0 ? formatCurrency(line.debit) : '\u2014'}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700 text-right tabular-nums">
                            {line.credit > 0 ? formatCurrency(line.credit) : '\u2014'}
                          </td>
                        </tr>
                      ))}
                      {/* Totals row */}
                      <tr className="border-t-2 border-slate-200 bg-slate-50/50">
                        <td
                          colSpan={3}
                          className="px-4 py-3 text-sm font-semibold text-slate-800 text-right"
                        >
                          Totals
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right tabular-nums">
                          {formatCurrency(entry.total_debit)}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-slate-900 text-right tabular-nums">
                          {formatCurrency(entry.total_credit)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 pt-2 flex flex-wrap items-center gap-2">
          {isManual && (
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
// New Entry Modal
// ---------------------------------------------------------------------------

function NewEntryModal({
  accounts,
  onClose,
  onCreated,
}: {
  accounts: Account[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [entryDate, setEntryDate] = useState(todayISO());
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<NewLine[]>([emptyLine(), emptyLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalDebit = useMemo(
    () => lines.reduce((sum, l) => sum + parseAmount(l.debit), 0),
    [lines]
  );
  const totalCredit = useMemo(
    () => lines.reduce((sum, l) => sum + parseAmount(l.credit), 0),
    [lines]
  );
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;

  const updateLine = (index: number, field: keyof NewLine, value: string | number | null) => {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [field]: value } : l))
    );
  };

  const addLine = () => {
    setLines((prev) => [...prev, emptyLine()]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!isBalanced) return;
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }

    const validLines = lines.filter((l) => l.account_id !== null && (parseAmount(l.debit) > 0 || parseAmount(l.credit) > 0));
    if (validLines.length < 2) {
      setError('At least 2 lines with accounts and amounts are required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await journalEntryAPI.create({
        entry_date: entryDate,
        description: description.trim(),
        entry_type: 'manual',
        lines: validLines.map((l) => ({
          account_id: l.account_id,
          description: l.description,
          debit: parseAmount(l.debit),
          credit: parseAmount(l.credit),
        })),
      });
      onCreated();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail || err?.message || 'Failed to create journal entry.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <Plus className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">New Journal Entry</h2>
                <p className="text-xs text-slate-400 mt-0.5">Manual double-entry booking</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Date & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Date
              </label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Office supplies purchase"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Lines
              </p>
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-500 transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Add Line
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 min-w-[200px]">
                        Account
                      </th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 min-w-[150px]">
                        Description
                      </th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400 w-[130px]">
                        Debit
                      </th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400 w-[130px]">
                        Credit
                      </th>
                      <th className="px-3 py-2.5 w-[40px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => (
                      <tr key={idx} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <AccountSelect
                            accounts={accounts}
                            value={line.account_id}
                            onChange={(id) => updateLine(idx, 'account_id', id)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={line.description}
                            onChange={(e) => updateLine(idx, 'description', e.target.value)}
                            placeholder="Line memo"
                            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all placeholder:text-slate-400"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.debit}
                            onChange={(e) => {
                              updateLine(idx, 'debit', e.target.value);
                              if (parseFloat(e.target.value) > 0) {
                                updateLine(idx, 'credit', '');
                              }
                            }}
                            placeholder="0.00"
                            className="w-full px-3 py-2 text-sm text-right bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all tabular-nums placeholder:text-slate-400"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.credit}
                            onChange={(e) => {
                              updateLine(idx, 'credit', e.target.value);
                              if (parseFloat(e.target.value) > 0) {
                                updateLine(idx, 'debit', '');
                              }
                            }}
                            placeholder="0.00"
                            className="w-full px-3 py-2 text-sm text-right bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all tabular-nums placeholder:text-slate-400"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            disabled={lines.length <= 2}
                            className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <MinusCircle className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr className="border-t-2 border-slate-200 bg-slate-50/50">
                      <td colSpan={2} className="px-3 py-3 text-sm font-semibold text-slate-800 text-right">
                        Totals
                      </td>
                      <td className="px-3 py-3 text-sm font-bold text-slate-900 text-right tabular-nums">
                        {formatCurrency(totalDebit)}
                      </td>
                      <td className="px-3 py-3 text-sm font-bold text-slate-900 text-right tabular-nums">
                        {formatCurrency(totalCredit)}
                      </td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Balance indicator */}
            <div className="mt-3 flex items-center gap-2">
              {totalDebit === 0 && totalCredit === 0 ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Enter amounts to continue
                </span>
              ) : isBalanced ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                  <Check className="w-3.5 h-3.5" />
                  Balanced
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-red-500">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Unbalanced by {formatCurrency(Math.abs(totalDebit - totalCredit))}
                </span>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 flex items-center gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 active:scale-[0.98] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isBalanced || submitting}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-sm shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Create Entry
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function JournalEntries() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  // Filters
  const [entryTypeFilter, setEntryTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [detailEntry, setDetailEntry] = useState<JournalEntry | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showNewEntry, setShowNewEntry] = useState(false);

  // Accounts for new entry form
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);

  // Load entries
  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      };
      if (entryTypeFilter) params.entry_type = entryTypeFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const result = await journalEntryAPI.list(params);
      setEntries(result.entries ?? []);
      setTotal(result.total ?? 0);
    } catch {
      setEntries([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, entryTypeFilter, startDate, endDate]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Load accounts for new-entry form
  const loadAccounts = useCallback(async () => {
    if (accountsLoaded) return;
    try {
      const result = await accountAPI.list({ active_only: false });
      setAccounts(result.accounts ?? []);
      setAccountsLoaded(true);
    } catch {
      setAccounts([]);
    }
  }, [accountsLoaded]);

  const handleNewEntry = () => {
    loadAccounts();
    setShowNewEntry(true);
  };

  const handleEntryCreated = () => {
    setShowNewEntry(false);
    setPage(0);
    loadEntries();
  };

  const handleViewDetail = async (entry: JournalEntry) => {
    setSelectedEntry(entry);
    setDetailEntry(null);
    setDetailLoading(true);
    try {
      const detail = await journalEntryAPI.get(entry.id);
      setDetailEntry(detail);
    } catch {
      // Show entry from list as fallback (it may already have lines)
      setDetailEntry(entry);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (entry: JournalEntry) => {
    if (!confirm(`Delete this journal entry "${entry.description}"?`)) return;
    try {
      await journalEntryAPI.delete(entry.id);
      setSelectedEntry(null);
      setDetailEntry(null);
      loadEntries();
    } catch {
      // silently fail
    }
  };

  const handleCloseDetail = () => {
    setSelectedEntry(null);
    setDetailEntry(null);
  };

  // Reset page when filters change
  const handleFilterChange = (setter: (v: string) => void, value: string) => {
    setter(value);
    setPage(0);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Journal Entries</h1>
          <p className="text-sm text-slate-500 mt-1">
            Double-entry bookkeeping records
          </p>
        </div>
        <button
          onClick={handleNewEntry}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-sm shadow-indigo-500/25"
        >
          <Plus className="w-4 h-4" />
          New Entry
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3 text-slate-500">
          <Filter className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Filters</span>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 flex-wrap">
          {/* Entry Type */}
          <div className="w-full sm:w-auto">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Type
            </label>
            <select
              value={entryTypeFilter}
              onChange={(e) => handleFilterChange(setEntryTypeFilter, e.target.value)}
              className="w-full sm:w-44 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
            >
              {ENTRY_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="w-full sm:w-auto">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              From
            </label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleFilterChange(setStartDate, e.target.value)}
                className="w-full sm:w-44 pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
              />
            </div>
          </div>

          {/* End Date */}
          <div className="w-full sm:w-auto">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              To
            </label>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleFilterChange(setEndDate, e.target.value)}
                className="w-full sm:w-44 pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all"
              />
            </div>
          </div>

          {/* Clear filters */}
          {(entryTypeFilter || startDate || endDate) && (
            <button
              onClick={() => {
                setEntryTypeFilter('');
                setStartDate('');
                setEndDate('');
                setPage(0);
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Entry List */}
      {loading ? (
        <LoadingState />
      ) : entries.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-slate-50/80">
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Date
                    </th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Description
                    </th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Reference
                    </th>
                    <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Type
                    </th>
                    <th className="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Debit
                    </th>
                    <th className="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Credit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const source = sourceLabel(entry);
                    return (
                      <tr
                        key={entry.id}
                        className="group hover:bg-slate-50/80 cursor-pointer transition-colors border-b border-slate-100 last:border-b-0"
                        onClick={() => handleViewDetail(entry)}
                      >
                        <td className="px-5 py-4">
                          <span className="text-sm text-slate-600">
                            {formatDate(entry.entry_date)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate max-w-[300px]">
                              {entry.description}
                            </p>
                            {source && (
                              <p className="text-xs text-slate-400 italic mt-0.5">{source}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-sm text-slate-600">
                            {entry.reference || '\u2014'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <TypeBadge entryType={entry.entry_type} />
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="text-sm font-semibold text-slate-800 tabular-nums">
                            {formatCurrency(entry.total_debit)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="text-sm font-semibold text-slate-800 tabular-nums">
                            {formatCurrency(entry.total_credit)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {entries.map((entry) => {
              const source = sourceLabel(entry);
              return (
                <div
                  key={entry.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
                  onClick={() => handleViewDetail(entry)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {entry.description}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatDate(entry.entry_date)}
                        {entry.reference && ` \u00B7 Ref: ${entry.reference}`}
                      </p>
                      {source && (
                        <p className="text-xs text-slate-400 italic mt-0.5">{source}</p>
                      )}
                    </div>
                    <TypeBadge entryType={entry.entry_type} />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-slate-500">
                        DR{' '}
                        <span className="font-semibold text-slate-800 tabular-nums">
                          {formatCurrency(entry.total_debit)}
                        </span>
                      </span>
                      <span className="text-slate-500">
                        CR{' '}
                        <span className="font-semibold text-slate-800 tabular-nums">
                          {formatCurrency(entry.total_credit)}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <p className="text-xs text-slate-400">
              Showing {page * PAGE_SIZE + 1}
              &ndash;
              {Math.min((page + 1) * PAGE_SIZE, total)} of {total} entr{total !== 1 ? 'ies' : 'y'}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <span className="text-xs text-slate-500 tabular-nums">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Detail Modal */}
      {selectedEntry && detailLoading && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={handleCloseDetail}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-12 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
            <p className="text-sm font-medium text-slate-400">Loading entry details...</p>
          </div>
        </div>
      )}
      {selectedEntry && detailEntry && !detailLoading && (
        <DetailModal
          entry={detailEntry}
          onClose={handleCloseDetail}
          onDelete={() => handleDelete(detailEntry)}
        />
      )}

      {/* New Entry Modal */}
      {showNewEntry && (
        <NewEntryModal
          accounts={accounts}
          onClose={() => setShowNewEntry(false)}
          onCreated={handleEntryCreated}
        />
      )}
    </div>
  );
}
