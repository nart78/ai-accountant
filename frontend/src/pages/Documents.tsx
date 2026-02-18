import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { documentAPI } from '../services/api';

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

const STATUS_STYLES: Record<string, string> = {
  processed: 'bg-green-100 text-green-800',
  review_needed: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-blue-100 text-blue-800',
  error: 'bg-red-100 text-red-800',
};

const CATEGORY_EMOJI: Record<string, string> = {
  office_supplies: '🖊️',
  rent: '🏢',
  utilities: '💡',
  meals_and_entertainment: '🍽️',
  travel: '✈️',
  vehicle_expenses: '🚗',
  professional_fees: '💼',
  insurance: '🛡️',
  bank_fees: '🏦',
  advertising: '📢',
  software_subscriptions: '💻',
  equipment: '🔧',
  repairs_and_maintenance: '🔨',
  employee_wages: '👥',
  contractor_payments: '📋',
  inventory: '📦',
  shipping: '📬',
  taxes_and_licenses: '📜',
  other: '📄',
};

export default function Documents() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Document | null>(null);

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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newUploads: UploadState[] = acceptedFiles.map((f) => ({
      file: f,
      status: 'uploading',
      message: 'Uploading...',
    }));
    setUploads((prev) => [...newUploads, ...prev]);

    for (const file of acceptedFiles) {
      try {
        await documentAPI.upload(file);
        setUploads((prev) =>
          prev.map((u) =>
            u.file === file ? { ...u, status: 'done', message: 'Uploaded! AI is processing...' } : u
          )
        );
      } catch (err: any) {
        setUploads((prev) =>
          prev.map((u) =>
            u.file === file ? { ...u, status: 'error', message: err.message ?? 'Upload failed' } : u
          )
        );
      }
    }

    // Reload list after uploads settle
    setTimeout(() => {
      loadDocuments();
      setUploads([]);
    }, 2000);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
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

  const filteredDocs = documents;

  return (
    <div className="px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Documents</h1>

      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-white hover:border-indigo-400 hover:bg-indigo-50'
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-5xl mb-4">📂</p>
        {isDragActive ? (
          <p className="text-lg font-semibold text-indigo-600">Drop your files here...</p>
        ) : (
          <>
            <p className="text-lg font-semibold text-gray-700">Drag &amp; drop documents here</p>
            <p className="text-sm text-gray-500 mt-2">or click to browse files</p>
            <p className="text-xs text-gray-400 mt-3">
              Supported: PDF, PNG, JPG, CSV, XLSX · Max 10 MB · AI will automatically categorize everything
            </p>
          </>
        )}
      </div>

      {/* Active Uploads */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((u, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm ${
                u.status === 'error'
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : u.status === 'done'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-blue-50 border-blue-200 text-blue-700'
              }`}
            >
              {u.status === 'uploading' && (
                <span className="animate-spin inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
              )}
              {u.status === 'done' && <span>✅</span>}
              {u.status === 'error' && <span>❌</span>}
              <span className="font-medium truncate">{u.file.name}</span>
              <span className="ml-auto shrink-0">{u.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {[
          { key: 'all', label: 'All' },
          { key: 'review_needed', label: '⚠️ Needs Review' },
          { key: 'processed', label: '✅ Processed' },
          { key: 'pending', label: '⏳ Processing' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              filter === tab.key
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Document List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🗂️</p>
          <p className="font-medium">No documents found</p>
          <p className="text-sm mt-1">Upload a receipt or invoice to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type / Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDocs.map((doc) => (
                <tr
                  key={doc.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelected(doc)}
                >
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900 truncate max-w-xs">{doc.filename}</p>
                    <p className="text-xs text-gray-400">{new Date(doc.created_at).toLocaleDateString('en-CA')}</p>
                  </td>
                  <td className="px-6 py-4">
                    {doc.category ? (
                      <span className="text-sm text-gray-700">
                        {CATEGORY_EMOJI[doc.category] ?? '📄'} {doc.category.replace(/_/g, ' ')}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400 italic">categorizing...</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{doc.vendor ?? '—'}</td>
                  <td className="px-6 py-4 text-right">
                    {doc.amount != null ? (
                      <span className="text-sm font-semibold text-gray-900">
                        ${doc.amount.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {doc.date ? new Date(doc.date).toLocaleDateString('en-CA') : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_STYLES[doc.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {doc.status.replace('_', ' ')}
                    </span>
                    {doc.confidence != null && (
                      <span className="ml-2 text-xs text-gray-400">
                        {Math.round(doc.confidence * 100)}%
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2">
                      {doc.needs_review && (
                        <button
                          onClick={() => handleApprove(doc)}
                          className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
                        >
                          Approve
                        </button>
                      )}
                      <button
                        onClick={() => handleReprocess(doc)}
                        className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                      >
                        Reprocess
                      </button>
                      <button
                        onClick={() => handleDelete(doc)}
                        className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-bold text-gray-900 truncate pr-4">{selected.filename}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Detail label="Status" value={selected.status.replace('_', ' ')} />
              <Detail label="Type" value={selected.type ?? 'Unknown'} />
              <Detail label="Category" value={selected.category?.replace(/_/g, ' ') ?? '—'} />
              <Detail label="Vendor" value={selected.vendor ?? '—'} />
              <Detail label="Amount" value={selected.amount != null ? `$${selected.amount.toFixed(2)} CAD` : '—'} />
              <Detail label="Date" value={selected.date ? new Date(selected.date).toLocaleDateString('en-CA') : '—'} />
              <Detail label="AI Confidence" value={selected.confidence != null ? `${Math.round(selected.confidence * 100)}%` : '—'} />
              <Detail label="Uploaded" value={new Date(selected.created_at).toLocaleDateString('en-CA')} />
            </div>
            <div className="flex gap-3 pt-2">
              {selected.needs_review && (
                <button
                  onClick={() => handleApprove(selected)}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700"
                >
                  ✅ Approve Categorization
                </button>
              )}
              <button
                onClick={() => handleDelete(selected)}
                className="px-4 bg-red-100 text-red-700 py-2 rounded-lg text-sm font-medium hover:bg-red-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase font-medium">{label}</p>
      <p className="text-gray-900 mt-0.5 font-medium capitalize">{value}</p>
    </div>
  );
}
