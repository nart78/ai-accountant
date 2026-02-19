import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { invoiceAPI, customerAPI } from '../services/api';
import { ArrowLeft, Plus, Trash2, UserPlus, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
}

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVINCES = [
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
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

export default function InvoiceForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  // Customer state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    address_line1: '',
    city: '',
    province: '',
    postal_code: '',
  });
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Invoice details
  const [invoiceDate, setInvoiceDate] = useState(todayString());
  const [dueDate, setDueDate] = useState(defaultDueDateString());
  const [notes, setNotes] = useState('');
  const [applyGST, setApplyGST] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');

  // Line items
  const [items, setItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unit_price: 0 },
  ]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [businessExpanded, setBusinessExpanded] = useState(false);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (id) {
      loadInvoice();
    } else {
      setLoading(false);
    }
  }, [id]);

  const loadCustomers = async () => {
    try {
      const result = await customerAPI.list();
      setCustomers(result.customers || []);
    } catch {
      setCustomers([]);
    }
  };

  const loadInvoice = async () => {
    setLoading(true);
    try {
      const invoice = await invoiceAPI.get(Number(id));
      if (invoice.status !== 'draft') {
        navigate('/invoices');
        return;
      }
      setCustomerId(invoice.customer_id);
      setInvoiceDate(toDateInputValue(invoice.invoice_date));
      setDueDate(toDateInputValue(invoice.due_date));
      setNotes(invoice.notes || '');
      setApplyGST(invoice.gst_rate > 0);
      setInvoiceNumber(invoice.invoice_number || '');
      if (invoice.items && invoice.items.length > 0) {
        setItems(
          invoice.items.map((item: any) => ({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
          }))
        );
      }
    } catch {
      navigate('/invoices');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Customer creation
  // ---------------------------------------------------------------------------

  const handleAddCustomer = async () => {
    if (!newCustomer.name.trim()) return;
    setSavingCustomer(true);
    try {
      const created = await customerAPI.create({
        name: newCustomer.name.trim(),
        email: newCustomer.email.trim() || null,
        phone: newCustomer.phone.trim() || null,
        address_line1: newCustomer.address_line1.trim() || null,
        city: newCustomer.city.trim() || null,
        province: newCustomer.province || null,
        postal_code: newCustomer.postal_code.trim() || null,
      });
      await loadCustomers();
      setCustomerId(created.id);
      setShowNewCustomer(false);
      setNewCustomer({
        name: '',
        email: '',
        phone: '',
        address_line1: '',
        city: '',
        province: '',
        postal_code: '',
      });
      setErrors((prev) => {
        const next = { ...prev };
        delete next.customer;
        return next;
      });
    } catch {
      // silently fail
    } finally {
      setSavingCustomer(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Line item helpers
  // ---------------------------------------------------------------------------

  const addLineItem = () => {
    setItems((prev) => [...prev, { description: '', quantity: 1, unit_price: 0 }]);
  };

  const removeLineItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
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
  // Selected customer details
  // ---------------------------------------------------------------------------

  const selectedCustomer = customers.find((c) => c.id === customerId);

  // ---------------------------------------------------------------------------
  // Validation & submit
  // ---------------------------------------------------------------------------

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!customerId) {
      newErrors.customer = 'Please select a customer';
    }

    if (dueDate < invoiceDate) {
      newErrors.dueDate = 'Due date must be on or after the invoice date';
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
        customer_id: customerId,
        invoice_date: invoiceDate,
        due_date: dueDate,
        notes: notes.trim() || null,
        apply_gst: applyGST,
        items: items.map((item) => ({
          description: item.description.trim(),
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      };

      if (isEdit) {
        await invoiceAPI.update(Number(id), payload);
      } else {
        await invoiceAPI.create(payload);
      }

      navigate('/invoices');
    } catch {
      // silently fail
    } finally {
      setSaving(false);
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
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/invoices')}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold text-slate-900">
            {isEdit ? `Edit Invoice ${invoiceNumber}` : 'New Invoice'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save as Draft
          </button>
        </div>
      </div>

      {/* Invoice Paper */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">

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

        {/* Customer + Invoice Info Row */}
        <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-200">
          {/* Left: Customer */}
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-2">Bill To</label>

            {!showNewCustomer ? (
              <div>
                <select
                  value={customerId}
                  onChange={(e) => {
                    setCustomerId(e.target.value ? Number(e.target.value) : '');
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.customer;
                      return next;
                    });
                  }}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                >
                  <option value="">Add a customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {errors.customer && (
                  <p className="text-xs text-red-500 mt-1">{errors.customer}</p>
                )}

                {/* Selected customer address preview */}
                {selectedCustomer && (
                  <div className="mt-2 text-sm text-slate-500 space-y-0.5">
                    {selectedCustomer.address_line1 && <p>{selectedCustomer.address_line1}</p>}
                    {(selectedCustomer.city || selectedCustomer.province || selectedCustomer.postal_code) && (
                      <p>
                        {[selectedCustomer.city, selectedCustomer.province, selectedCustomer.postal_code]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    )}
                    {selectedCustomer.email && <p>{selectedCustomer.email}</p>}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowNewCustomer(true)}
                  className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-500 mt-2 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  New customer
                </button>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newCustomer.name}
                    onChange={(e) =>
                      setNewCustomer((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                    placeholder="Customer name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                    <input
                      type="email"
                      value={newCustomer.email}
                      onChange={(e) =>
                        setNewCustomer((prev) => ({ ...prev, email: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={newCustomer.phone}
                      onChange={(e) =>
                        setNewCustomer((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Address</label>
                  <input
                    type="text"
                    value={newCustomer.address_line1}
                    onChange={(e) =>
                      setNewCustomer((prev) => ({ ...prev, address_line1: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                    placeholder="123 Main St"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">City</label>
                    <input
                      type="text"
                      value={newCustomer.city}
                      onChange={(e) =>
                        setNewCustomer((prev) => ({ ...prev, city: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                      placeholder="Calgary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Province</label>
                    <select
                      value={newCustomer.province}
                      onChange={(e) =>
                        setNewCustomer((prev) => ({ ...prev, province: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                    >
                      <option value="">--</option>
                      {PROVINCES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Postal</label>
                    <input
                      type="text"
                      value={newCustomer.postal_code}
                      onChange={(e) =>
                        setNewCustomer((prev) => ({ ...prev, postal_code: e.target.value }))
                      }
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
                      placeholder="T2X 1A1"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleAddCustomer}
                    disabled={savingCustomer || !newCustomer.name.trim()}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {savingCustomer && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewCustomer(false)}
                    className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Invoice Number + Dates */}
          <div className="space-y-4">
            {isEdit && invoiceNumber && (
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">Invoice Number</label>
                <p className="text-sm font-semibold text-slate-800">{invoiceNumber}</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Invoice Date</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
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
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
              />
              {errors.dueDate && (
                <p className="text-xs text-red-500 mt-1">{errors.dueDate}</p>
              )}
            </div>
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
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
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
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
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
                        className="w-full pl-7 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
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
                    {items.length > 1 && (
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
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
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
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
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
                          className="w-full pl-7 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
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
                    {items.length > 1 && (
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
          <button
            type="button"
            onClick={addLineItem}
            className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-500 mt-3 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add an item
          </button>
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

              <div className="border-t border-slate-200 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-slate-900">Amount Due</span>
                  <div className="text-right">
                    <span className="text-lg font-bold text-slate-900 tabular-nums">
                      {formatCurrency(calculateTotal())}
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
          <label className="block text-sm font-medium text-slate-500 mb-2">Notes / Terms</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Enter any notes or terms of service that apply to this invoice"
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all min-h-[80px] resize-none"
          />
        </div>
      </div>

      {/* Bottom Actions (mobile) */}
      <div className="sm:hidden flex gap-2 mt-4">
        <button
          type="button"
          onClick={() => navigate('/invoices')}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save as Draft
        </button>
      </div>
    </div>
  );
}
