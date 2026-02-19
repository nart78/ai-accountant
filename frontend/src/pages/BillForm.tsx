import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { billAPI, customerAPI, accountAPI } from '../services/api';
import { ArrowLeft, Plus, Trash2, Loader2, ChevronDown, ChevronUp, CreditCard } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Vendor {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  contact_type?: string;
}

interface ExpenseAccount {
  id: number;
  name: string;
  account_number: string;
  account_type: string;
}

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  account_id: number | null;
}

interface BillData {
  id: number;
  bill_number: string;
  status: string;
  vendor_id: number;
  bill_date: string;
  due_date: string;
  notes: string | null;
  gst_rate: number;
  subtotal: number;
  total: number;
  amount_paid: number;
  expense_account_id: number | null;
  items: any[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'e_transfer', label: 'E-Transfer' },
  { value: 'other', label: 'Other' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount);
}

function todayString(): string {
  return new Date().toISOString().split('T')[0];
}

function defaultDueDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
}

function toDateInputValue(iso: string): string {
  return iso.split('T')[0];
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function BillForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  // Vendor state
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState<number | ''>('');

  // Expense accounts
  const [expenseAccounts, setExpenseAccounts] = useState<ExpenseAccount[]>([]);
  const [expenseAccountId, setExpenseAccountId] = useState<number | ''>('');

  // Bill details
  const [billDate, setBillDate] = useState(todayString());
  const [dueDate, setDueDate] = useState(defaultDueDateString());
  const [notes, setNotes] = useState('');
  const [applyGST, setApplyGST] = useState(false);
  const [billNumber, setBillNumber] = useState('');

  // Line items
  const [items, setItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unit_price: 0, account_id: null },
  ]);

  // Bill data (for edit mode)
  const [billData, setBillData] = useState<BillData | null>(null);

  // Payment state (edit mode only)
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(todayString());
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [businessExpanded, setBusinessExpanded] = useState(false);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  useEffect(() => {
    loadVendors();
    loadExpenseAccounts();
  }, []);

  useEffect(() => {
    if (id) {
      loadBill();
    } else {
      setLoading(false);
    }
  }, [id]);

  const loadVendors = async () => {
    try {
      const result = await customerAPI.list();
      // Show all customers (vendor filtering may not be supported yet)
      setVendors(result.customers || []);
    } catch {
      setVendors([]);
    }
  };

  const loadExpenseAccounts = async () => {
    try {
      const result = await accountAPI.list({ account_type: 'expense', active_only: true });
      setExpenseAccounts(result.accounts || result || []);
    } catch {
      setExpenseAccounts([]);
    }
  };

  const loadBill = async () => {
    setLoading(true);
    try {
      const bill: BillData = await billAPI.get(Number(id));
      setBillData(bill);
      setVendorId(bill.vendor_id);
      setBillDate(toDateInputValue(bill.bill_date));
      setDueDate(toDateInputValue(bill.due_date));
      setNotes(bill.notes || '');
      setApplyGST(bill.gst_rate > 0);
      setBillNumber(bill.bill_number || '');
      setExpenseAccountId(bill.expense_account_id || '');
      if (bill.items && bill.items.length > 0) {
        setItems(
          bill.items.map((item: any) => ({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            account_id: item.account_id || null,
          }))
        );
      }
      // Pre-fill payment amount with remaining balance
      const remaining = bill.total - (bill.amount_paid || 0);
      setPaymentAmount(Math.max(0, remaining));
    } catch {
      navigate('/bills');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Line item helpers
  // ---------------------------------------------------------------------------

  const addLineItem = () => {
    setItems((prev) => [...prev, { description: '', quantity: 1, unit_price: 0, account_id: null }]);
  };

  const removeLineItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number | null) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  // ---------------------------------------------------------------------------
  // Calculations
  // ---------------------------------------------------------------------------

  const calculateSubtotal = (): number =>
    items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  const calculateGST = (): number => (applyGST ? calculateSubtotal() * 0.05 : 0);

  const calculateTotal = (): number => calculateSubtotal() + calculateGST();

  // ---------------------------------------------------------------------------
  // Selected vendor details
  // ---------------------------------------------------------------------------

  const selectedVendor = vendors.find((v) => v.id === vendorId);

  // ---------------------------------------------------------------------------
  // Can show payment section?
  // ---------------------------------------------------------------------------

  const canRecordPayment =
    isEdit &&
    billData &&
    ['received', 'overdue', 'partial'].includes(billData.status);

  const amountOwing = billData
    ? billData.total - (billData.amount_paid || 0)
    : calculateTotal();

  // ---------------------------------------------------------------------------
  // Validation & submit
  // ---------------------------------------------------------------------------

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!vendorId) {
      newErrors.vendor = 'Please select a vendor';
    }

    if (dueDate < billDate) {
      newErrors.dueDate = 'Due date must be on or after the bill date';
    }

    if (items.length === 0) {
      newErrors.items = 'At least one line item is required';
    }

    items.forEach((item, i) => {
      if (!item.description.trim()) {
        newErrors[`item_${i}_description`] = 'Description is required';
      }
      if (item.unit_price <= 0) {
        newErrors[`item_${i}_unit_price`] = 'Price must be greater than 0';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        vendor_id: vendorId,
        bill_date: billDate,
        due_date: dueDate,
        notes: notes.trim() || null,
        apply_gst: applyGST,
        expense_account_id: expenseAccountId || null,
        items: items.map((item) => ({
          description: item.description.trim(),
          quantity: item.quantity,
          unit_price: item.unit_price,
          account_id: item.account_id || null,
        })),
      };

      if (isEdit) {
        await billAPI.update(Number(id), payload);
      } else {
        await billAPI.create(payload);
      }

      navigate('/bills');
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Record Payment
  // ---------------------------------------------------------------------------

  const handleRecordPayment = async () => {
    if (!id) return;
    if (paymentAmount <= 0) return;

    setSavingPayment(true);
    setPaymentSuccess('');
    try {
      await billAPI.recordPayment(Number(id), {
        amount: paymentAmount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        reference: paymentReference.trim() || null,
        notes: paymentNotes.trim() || null,
      });
      setPaymentSuccess('Payment recorded successfully');
      setPaymentReference('');
      setPaymentNotes('');
      // Reload bill to get updated amounts
      await loadBill();
      setShowPayment(false);
    } catch {
      // silently fail
    } finally {
      setSavingPayment(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-400">Loading...</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Whether the bill is editable (only draft bills, or new bills)
  // ---------------------------------------------------------------------------

  const isEditable = !isEdit || (billData && billData.status === 'draft');

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/bills')}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold text-slate-900">
            {isEdit ? `Edit Bill ${billNumber}` : 'New Bill'}
          </h1>
          {isEdit && billData && (
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                billData.status === 'draft'
                  ? 'bg-slate-100 text-slate-600'
                  : billData.status === 'received'
                  ? 'bg-blue-100 text-blue-700'
                  : billData.status === 'paid'
                  ? 'bg-emerald-100 text-emerald-700'
                  : billData.status === 'overdue'
                  ? 'bg-red-100 text-red-700'
                  : billData.status === 'partial'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {billData.status.charAt(0).toUpperCase() + billData.status.slice(1)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/bills')}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          {isEditable && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Save Bill' : 'Save as Draft'}
            </button>
          )}
        </div>
      </div>

      {/* Bill Paper */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">

        {/* Business Details Collapsible */}
        <div className="border-b border-slate-200">
          <button
            type="button"
            onClick={() => setBusinessExpanded(!businessExpanded)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
          >
            <span className="text-sm text-slate-500">
              Business address and contact details
            </span>
            {businessExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
          {businessExpanded && (
            <div className="px-6 pb-4 text-sm text-slate-600 space-y-0.5">
              <p className="font-semibold text-slate-900">2191584 Alberta Inc.</p>
              <p className="text-xs text-slate-400 mt-1">GST# 794689075 RT0001</p>
            </div>
          )}
        </div>

        {/* Vendor + Bill Info Row */}
        <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-200">
          {/* Left: Vendor */}
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-2">Vendor</label>
            <select
              value={vendorId}
              onChange={(e) => {
                setVendorId(e.target.value ? Number(e.target.value) : '');
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.vendor;
                  return next;
                });
              }}
              disabled={!isEditable}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="">Select a vendor</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            {errors.vendor && (
              <p className="text-xs text-red-500 mt-1">{errors.vendor}</p>
            )}

            {/* Selected vendor address preview */}
            {selectedVendor && (
              <div className="mt-2 text-sm text-slate-500 space-y-0.5">
                {selectedVendor.address_line1 && <p>{selectedVendor.address_line1}</p>}
                {(selectedVendor.city || selectedVendor.province || selectedVendor.postal_code) && (
                  <p>
                    {[selectedVendor.city, selectedVendor.province, selectedVendor.postal_code]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
                {selectedVendor.email && <p>{selectedVendor.email}</p>}
              </div>
            )}
          </div>

          {/* Right: Bill Number + Dates */}
          <div className="space-y-4">
            {isEdit && billNumber && (
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">Bill Number</label>
                <p className="text-sm font-semibold text-slate-800">{billNumber}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Bill Date</label>
              <input
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                disabled={!isEditable}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Payment Due</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.dueDate;
                    return next;
                  });
                }}
                disabled={!isEditable}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all disabled:bg-slate-50 disabled:text-slate-500"
              />
              {errors.dueDate && (
                <p className="text-xs text-red-500 mt-1">{errors.dueDate}</p>
              )}
            </div>

            {/* Expense Account Selector */}
            {expenseAccounts.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">Expense Account</label>
                <select
                  value={expenseAccountId}
                  onChange={(e) => setExpenseAccountId(e.target.value ? Number(e.target.value) : '')}
                  disabled={!isEditable}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                >
                  <option value="">None (set per line item)</option>
                  {expenseAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.account_number} - {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="px-6 py-6 border-b border-slate-200">
          {errors.items && (
            <p className="text-xs text-red-500 mb-3">{errors.items}</p>
          )}

          {/* Table Header */}
          <div className="hidden sm:grid sm:grid-cols-12 gap-3 pb-2 border-b border-slate-100 mb-1">
            <div className="col-span-5 text-xs font-medium text-slate-400 uppercase tracking-wider">Items</div>
            <div className="col-span-2 text-xs font-medium text-slate-400 uppercase tracking-wider">Quantity</div>
            <div className="col-span-2 text-xs font-medium text-slate-400 uppercase tracking-wider">Price</div>
            <div className="col-span-2 text-xs font-medium text-slate-400 uppercase tracking-wider text-right">Amount</div>
            <div className="col-span-1"></div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-slate-50">
            {items.map((item, index) => (
              <div key={index} className="py-3">
                {/* Desktop row */}
                <div className="hidden sm:grid sm:grid-cols-12 gap-3 items-center">
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                      placeholder="Description"
                      disabled={!isEditable}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                    />
                    {errors[`item_${index}_description`] && (
                      <p className="text-xs text-red-500 mt-0.5">{errors[`item_${index}_description`]}</p>
                    )}
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateLineItem(index, 'quantity', Math.max(1, Number(e.target.value)))
                      }
                      disabled={!isEditable}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price || ''}
                        onChange={(e) =>
                          updateLineItem(index, 'unit_price', Math.max(0, Number(e.target.value)))
                        }
                        disabled={!isEditable}
                        className="w-full pl-7 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                      />
                    </div>
                    {errors[`item_${index}_unit_price`] && (
                      <p className="text-xs text-red-500 mt-0.5">{errors[`item_${index}_unit_price`]}</p>
                    )}
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="text-sm font-medium text-slate-800 tabular-nums">
                      {formatCurrency(item.quantity * item.unit_price)}
                    </span>
                  </div>
                  <div className="col-span-1 text-right">
                    {items.length > 1 && isEditable && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Mobile layout */}
                <div className="sm:hidden space-y-2">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                    placeholder="Description"
                    disabled={!isEditable}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                  />
                  {errors[`item_${index}_description`] && (
                    <p className="text-xs text-red-500">{errors[`item_${index}_description`]}</p>
                  )}
                  <div className="flex gap-2 items-center">
                    <div className="w-20">
                      <label className="block text-xs text-slate-400 mb-0.5">Qty</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateLineItem(index, 'quantity', Math.max(1, Number(e.target.value)))
                        }
                        disabled={!isEditable}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-slate-400 mb-0.5">Price</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price || ''}
                          onChange={(e) =>
                            updateLineItem(index, 'unit_price', Math.max(0, Number(e.target.value)))
                          }
                          disabled={!isEditable}
                          className="w-full pl-7 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                        />
                      </div>
                      {errors[`item_${index}_unit_price`] && (
                        <p className="text-xs text-red-500 mt-0.5">{errors[`item_${index}_unit_price`]}</p>
                      )}
                    </div>
                    <div className="text-right pt-4">
                      <span className="text-sm font-medium text-slate-800 tabular-nums">
                        {formatCurrency(item.quantity * item.unit_price)}
                      </span>
                    </div>
                    {items.length > 1 && isEditable && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        className="p-1 rounded text-slate-300 hover:text-red-500 mt-4"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Item Button */}
          {isEditable && (
            <button
              type="button"
              onClick={addLineItem}
              className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-500 mt-3 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add an item
            </button>
          )}
        </div>

        {/* Totals Section */}
        <div className="px-6 py-6 border-b border-slate-200">
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Subtotal</span>
                <span className="text-sm text-slate-800 tabular-nums">
                  {formatCurrency(calculateSubtotal())}
                </span>
              </div>

              {/* GST Toggle */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyGST}
                    onChange={(e) => setApplyGST(e.target.checked)}
                    disabled={!isEditable}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-500">GST (5%)</span>
                </label>
                {applyGST && (
                  <span className="text-sm text-slate-800 tabular-nums">
                    {formatCurrency(calculateGST())}
                  </span>
                )}
              </div>

              <div className="border-t border-slate-200 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">Total</span>
                  <span className="text-sm font-semibold text-slate-800 tabular-nums">
                    {formatCurrency(calculateTotal())}
                  </span>
                </div>
              </div>

              {/* Amount Paid (edit mode) */}
              {isEdit && billData && (billData.amount_paid || 0) > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-emerald-600">Amount Paid</span>
                  <span className="text-sm text-emerald-600 tabular-nums">
                    -{formatCurrency(billData.amount_paid)}
                  </span>
                </div>
              )}

              <div className="border-t border-slate-200 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-slate-900">Amount Owing</span>
                  <div className="text-right">
                    <span className="text-lg font-bold text-slate-900 tabular-nums">
                      {formatCurrency(amountOwing)}
                    </span>
                    <span className="text-xs text-slate-400 ml-1">CAD</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes Section */}
        <div className="px-6 py-6">
          <label className="block text-sm font-medium text-slate-500 mb-2">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Enter any notes related to this bill"
            disabled={!isEditable}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all min-h-[80px] resize-none disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>
      </div>

      {/* Record Payment Section (edit mode only) */}
      {canRecordPayment && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200">
          <button
            type="button"
            onClick={() => {
              setShowPayment(!showPayment);
              setPaymentSuccess('');
            }}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors rounded-xl"
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-medium text-slate-700">Record Payment</span>
            </div>
            {showPayment ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {showPayment && (
            <div className="px-6 pb-6 space-y-4">
              <div className="border-t border-slate-200 pt-4">
                {paymentSuccess && (
                  <div className="mb-4 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
                    {paymentSuccess}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">
                      Payment Amount <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={paymentAmount || ''}
                        onChange={(e) => setPaymentAmount(Math.max(0, Number(e.target.value)))}
                        className="w-full pl-7 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Balance owing: {formatCurrency(amountOwing)}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">
                      Payment Date <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-500 mb-1">Reference</label>
                    <input
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="CHQ-123, Transfer #, etc."
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-1">Payment Notes</label>
                  <input
                    type="text"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Optional notes"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleRecordPayment}
                    disabled={savingPayment || paymentAmount <= 0}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {savingPayment && <Loader2 className="w-4 h-4 animate-spin" />}
                    Record Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPayment(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Actions (mobile) */}
      <div className="sm:hidden flex gap-2 mt-4">
        <button
          type="button"
          onClick={() => navigate('/bills')}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        {isEditable && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Save Bill' : 'Save as Draft'}
          </button>
        )}
      </div>
    </div>
  );
}
