import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { documentAPI } from '../services/api';
import { format } from 'date-fns';
import {
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  FileText,
  FolderOpen,
  Search,
  X,
  RefreshCw,
  Trash2,
  CheckCheck,
  Eye,
  AlertTriangle,
  Clock,
  ChevronRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Document {
  id: number;
  filename: string;
  type: string | null;
  category: string | null;
  vendor: string | null;
  amount: number | null;
  date: string | null;
  status: string;
  confidence: number | null;
  needs_review: boolean;
  created_at: string;
}

interface UploadState {
  file: File;
  status: 'uploading' | 'done' | 'error';
  message: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  processed: {
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'Processed',
  },
  review_needed: {
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    label: 'Needs Review',
  },
  pending: {
    bg: 'bg-slate-50 border-slate-200',
    text: 'text-slate-600',
    dot: 'bg-slate-400',
    label: 'Processing',
  },
  error: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-700',
    dot: 'bg-red-500',
    label: 'Error',
  },
};

const CATEGORY_EMOJI: Record<string, string> = {
  office_supplies: '\uD83D\uDCCB',
  rent: '\uD83C\uDFE2',
  utilities: '\uD83D\uDCA1',
  meals_and_entertainment: '\uD83C\uDF7D\uFE0F',
  travel: '\u2708\uFE0F',
  vehicle_expenses: '\uD83D\uDE97',
  professional_fees: '\uD83D\uDCBC',
  insurance: '\uD83D\uDEE1\uFE0F',
  bank_fees: '\uD83C\uDFE6',
  advertising: '\uD83D\uDCE2',
  software_subscriptions: '\uD83D\uDCBB',
  equipment: '\uD83D\uDD27',
  repairs_and_maintenance: '\uD83D\uDD28',
  employee_wages: '\uD83D\uDC65',
  contractor_payments: '\uD83D\uDCCB',
  inventory: '\uD83D\uDCE6',
  shipping: '\uD83D\uDCEC',
  taxes_and_licenses: '\uD83D\uDCDC',
  other: '\uD83D\uDCC4',
};

const FILTER_TABS = [
  { key: 'all', label: 'All', icon: FolderOpen },
  { key: 'review_needed', label: 'Needs Review', icon: AlertTriangle },
  { key: 'processed', label: 'Processed', icon: CheckCircle2 },
  { key: 'pending', label: 'Processing', icon: Clock },
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
    return format(new Date(dateString), 'MMM d, yyyy');
  } catch {
    return dateString;
  }
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'text-emerald-600';
  if (confidence >= 0.7) return 'text-amber-600';
  return 'text-red-500';
}

function confidenceBarColor(confidence: number): string {
  if (confidence >= 0.9) return 'bg-emerald-500';
  if (confidence >= 0.7) return 'bg-amber-500';
  return 'bg-red-500';
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

function ConfidenceMeter({ confidence }: { confidence: number | null }) {
  if (confidence == null) return <span className="text-xs text-slate-400">--</span>;
  const pct = Math.round(confidence * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${confidenceBarColor(confidence)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-medium tabular-nums ${confidenceColor(confidence)}`}>
        {pct}%
      </span>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800 capitalize">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <FileText className="w-8 h-8 text-slate-300" />
      </div>
      <p className="text-base font-semibold text-slate-500">No documents found</p>
      <p className="text-sm text-slate-400 mt-1">
        Upload a receipt or invoice to get started
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
      <p className="text-sm font-medium text-slate-400">Loading documents...</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload Progress Item
// ---------------------------------------------------------------------------

function UploadItem({ upload }: { upload: UploadState }) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
        upload.status === 'error'
          ? 'bg-red-50 border-red-200'
          : upload.status === 'done'
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-indigo-50 border-indigo-200'
      }`}
    >
      {upload.status === 'uploading' && (
        <Loader2 className="w-4 h-4 text-indigo-500 animate-spin flex-shrink-0" />
      )}
      {upload.status === 'done' && (
        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
      )}
      {upload.status === 'error' && (
        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
      )}
      <span className="text-sm font-medium text-slate-700 truncate min-w-0">
        {upload.file.name}
      </span>
      <span
        className={`ml-auto text-xs font-medium flex-shrink-0 ${
          upload.status === 'error'
            ? 'text-red-600'
            : upload.status === 'done'
              ? 'text-emerald-600'
              : 'text-indigo-600'
        }`}
      >
        {upload.message}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Document Row
// ---------------------------------------------------------------------------

function DocumentRow({
  doc,
  onSelect,
  onApprove,
  onReprocess,
  onDelete,
}: {
  doc: Document;
  onSelect: () => void;
  onApprove: () => void;
  onReprocess: () => void;
  onDelete: () => void;
}) {
  const emoji = doc.category ? CATEGORY_EMOJI[doc.category] ?? '\uD83D\uDCC4' : null;

  return (
    <tr
      className="group hover:bg-slate-50/80 cursor-pointer transition-colors border-b border-slate-100 last:border-b-0"
      onClick={onSelect}
    >
      {/* Document info */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate max-w-[240px]">
              {doc.filename}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Uploaded {formatDate(doc.created_at)}
            </p>
          </div>
        </div>
      </td>

      {/* Category */}
      <td className="px-5 py-4">
        {doc.category ? (
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{emoji}</span>
            <span className="text-sm text-slate-700 capitalize">
              {doc.category.replace(/_/g, ' ')}
            </span>
          </div>
        ) : (
          <span className="text-sm text-slate-400 italic">Categorizing...</span>
        )}
      </td>

      {/* Vendor */}
      <td className="px-5 py-4">
        <span className="text-sm text-slate-700">{doc.vendor ?? '\u2014'}</span>
      </td>

      {/* Amount */}
      <td className="px-5 py-4 text-right">
        {doc.amount != null ? (
          <span className="text-sm font-semibold text-slate-800 tabular-nums">
            {formatCurrency(doc.amount)}
          </span>
        ) : (
          <span className="text-sm text-slate-400">\u2014</span>
        )}
      </td>

      {/* Date */}
      <td className="px-5 py-4">
        <span className="text-sm text-slate-600">
          {doc.date ? formatDate(doc.date) : '\u2014'}
        </span>
      </td>

      {/* Status */}
      <td className="px-5 py-4">
        <div className="flex flex-col gap-1.5">
          <StatusBadge status={doc.status} />
          <ConfidenceMeter confidence={doc.confidence} />
        </div>
      </td>

      {/* Actions */}
      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {doc.needs_review && (
            <button
              onClick={onApprove}
              title="Approve"
              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onReprocess}
            title="Reprocess"
            className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            title="Delete"
            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onSelect}
            title="View details"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Mobile Document Card (shown on small screens)
// ---------------------------------------------------------------------------

function DocumentCard({
  doc,
  onSelect,
  onApprove,
  onReprocess,
  onDelete,
}: {
  doc: Document;
  onSelect: () => void;
  onApprove: () => void;
  onReprocess: () => void;
  onDelete: () => void;
}) {
  const emoji = doc.category ? CATEGORY_EMOJI[doc.category] ?? '\uD83D\uDCC4' : null;

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{doc.filename}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {formatDate(doc.created_at)}
            </p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 mt-1" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={doc.status} />
        {doc.category && (
          <span className="text-xs text-slate-500 capitalize flex items-center gap-1">
            <span>{emoji}</span>
            {doc.category.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {doc.vendor && <span>{doc.vendor}</span>}
          {doc.amount != null && (
            <span className="font-semibold text-slate-800">
              {formatCurrency(doc.amount)}
            </span>
          )}
        </div>
        <ConfidenceMeter confidence={doc.confidence} />
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {doc.needs_review && (
          <button
            onClick={onApprove}
            className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Approve
          </button>
        )}
        <button
          onClick={onReprocess}
          className="flex items-center gap-1 text-xs font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reprocess
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1 text-xs font-medium text-red-500 bg-red-50 px-2.5 py-1.5 rounded-lg hover:bg-red-100 transition-colors ml-auto"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail Modal
// ---------------------------------------------------------------------------

function DetailModal({
  doc,
  onClose,
  onApprove,
  onReprocess,
  onDelete,
}: {
  doc: Document;
  onClose: () => void;
  onApprove: () => void;
  onReprocess: () => void;
  onDelete: () => void;
}) {
  const emoji = doc.category ? CATEGORY_EMOJI[doc.category] ?? '\uD83D\uDCC4' : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95"
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
                <h2 className="text-lg font-bold text-slate-900 truncate">{doc.filename}</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Uploaded {formatDate(doc.created_at)}
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
            <StatusBadge status={doc.status} />
            <ConfidenceMeter confidence={doc.confidence} />
          </div>
        </div>

        {/* Extracted fields */}
        <div className="px-6 py-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <DetailField
              label="Document Type"
              value={doc.type ?? 'Unknown'}
            />
            <DetailField
              label="Category"
              value={
                doc.category
                  ? `${emoji} ${doc.category.replace(/_/g, ' ')}`
                  : '\u2014'
              }
            />
            <DetailField
              label="Vendor"
              value={doc.vendor ?? '\u2014'}
            />
            <DetailField
              label="Amount"
              value={doc.amount != null ? `${formatCurrency(doc.amount)}` : '\u2014'}
            />
            <DetailField
              label="Document Date"
              value={doc.date ? formatDate(doc.date) : '\u2014'}
            />
            <DetailField
              label="AI Confidence"
              value={
                doc.confidence != null
                  ? `${Math.round(doc.confidence * 100)}%`
                  : '\u2014'
              }
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 pt-2 flex flex-wrap items-center gap-2">
          {doc.needs_review && (
            <button
              onClick={onApprove}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-sm"
            >
              <CheckCheck className="w-4 h-4" />
              Approve Categorization
            </button>
          )}
          <button
            onClick={onReprocess}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 text-sm font-semibold rounded-xl hover:bg-indigo-100 active:scale-[0.98] transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Reprocess
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-100 active:scale-[0.98] transition-all ml-auto"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function Documents() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Document | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load documents whenever filter changes
  useEffect(() => {
    loadDocuments();
  }, [filter]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const result = await documentAPI.list(params);
      setDocuments(result.documents);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  // Drag-and-drop upload handler
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newUploads: UploadState[] = acceptedFiles.map((f) => ({
      file: f,
      status: 'uploading' as const,
      message: 'Uploading...',
    }));
    setUploads((prev) => [...newUploads, ...prev]);

    for (const file of acceptedFiles) {
      try {
        await documentAPI.upload(file);
        setUploads((prev) =>
          prev.map((u) =>
            u.file === file
              ? { ...u, status: 'done' as const, message: 'AI is processing...' }
              : u
          )
        );
      } catch (err: any) {
        setUploads((prev) =>
          prev.map((u) =>
            u.file === file
              ? { ...u, status: 'error' as const, message: err.message ?? 'Upload failed' }
              : u
          )
        );
      }
    }

    // Reload list after uploads settle
    setTimeout(() => {
      loadDocuments();
      setUploads([]);
    }, 2500);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxSize: 10 * 1024 * 1024,
  });

  const handleApprove = async (doc: Document) => {
    await documentAPI.review(doc.id, true);
    loadDocuments();
    setSelected(null);
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Delete "${doc.filename}"?`)) return;
    await documentAPI.delete(doc.id);
    loadDocuments();
    setSelected(null);
  };

  const handleReprocess = async (doc: Document) => {
    await documentAPI.reprocess(doc.id);
    loadDocuments();
  };

  // Client-side search filtering
  const filteredDocs = documents.filter((doc) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      doc.filename.toLowerCase().includes(q) ||
      (doc.vendor && doc.vendor.toLowerCase().includes(q)) ||
      (doc.category && doc.category.replace(/_/g, ' ').toLowerCase().includes(q))
    );
  });

  // Count badges
  const reviewCount = documents.filter((d) => d.needs_review).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Documents</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload receipts and invoices for AI-powered categorization
        </p>
      </div>

      {/* Upload Drop Zone */}
      <div
        {...getRootProps()}
        className={`relative rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center cursor-pointer transition-all duration-200 ${
          isDragActive
            ? 'border-indigo-400 bg-indigo-50 shadow-lg shadow-indigo-100'
            : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors ${
              isDragActive ? 'bg-indigo-100' : 'bg-slate-100'
            }`}
          >
            <Upload
              className={`w-6 h-6 transition-colors ${
                isDragActive ? 'text-indigo-600' : 'text-slate-400'
              }`}
            />
          </div>
          {isDragActive ? (
            <p className="text-base font-semibold text-indigo-600">
              Drop your files here...
            </p>
          ) : (
            <>
              <p className="text-base font-semibold text-slate-700">
                Drag & drop documents here
              </p>
              <p className="text-sm text-slate-400 mt-1">
                or <span className="text-indigo-600 font-medium">click to browse</span>
              </p>
            </>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            {['PDF', 'PNG', 'JPG', 'CSV', 'XLSX'].map((ext) => (
              <span
                key={ext}
                className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-slate-100 text-slate-500"
              >
                {ext}
              </span>
            ))}
            <span className="text-[11px] text-slate-400">Max 10 MB</span>
          </div>
        </div>
      </div>

      {/* Upload Progress */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((u, i) => (
            <UploadItem key={i} upload={u} />
          ))}
        </div>
      )}

      {/* Filters & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          {FILTER_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = filter === tab.key;
            const showBadge = tab.key === 'review_needed' && reviewCount > 0 && !isActive;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`relative flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                  isActive
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                {showBadge && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {reviewCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
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
      </div>

      {/* Document List */}
      {loading ? (
        <LoadingState />
      ) : filteredDocs.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="min-w-full">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Document
                  </th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Category
                  </th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Vendor
                  </th>
                  <th className="px-5 py-3.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Amount
                  </th>
                  <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Date
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
                {filteredDocs.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    onSelect={() => setSelected(doc)}
                    onApprove={() => handleApprove(doc)}
                    onReprocess={() => handleReprocess(doc)}
                    onDelete={() => handleDelete(doc)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3">
            {filteredDocs.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onSelect={() => setSelected(doc)}
                onApprove={() => handleApprove(doc)}
                onReprocess={() => handleReprocess(doc)}
                onDelete={() => handleDelete(doc)}
              />
            ))}
          </div>

          {/* Result count */}
          <p className="text-xs text-slate-400 text-center">
            Showing {filteredDocs.length} document{filteredDocs.length !== 1 ? 's' : ''}
            {searchQuery ? ` matching "${searchQuery}"` : ''}
          </p>
        </>
      )}

      {/* Detail Modal */}
      {selected && (
        <DetailModal
          doc={selected}
          onClose={() => setSelected(null)}
          onApprove={() => handleApprove(selected)}
          onReprocess={() => handleReprocess(selected)}
          onDelete={() => handleDelete(selected)}
        />
      )}
    </div>
  );
}
