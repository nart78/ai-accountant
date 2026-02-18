import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
import { reportsAPI } from '../services/api';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#ec4899'];

const CURRENT_YEAR = new Date().getFullYear();

export default function Reports() {
  const [tab, setTab] = useState<'pl' | 'expenses' | 'tax' | 'monthly'>('pl');
  const [year, setYear] = useState(CURRENT_YEAR);
  const [startDate, setStartDate] = useState(`${CURRENT_YEAR}-01-01`);
  const [endDate, setEndDate] = useState(`${CURRENT_YEAR}-12-31`);

  const [plData, setPlData] = useState<any>(null);
  const [expenseData, setExpenseData] = useState<any>(null);
  const [taxData, setTaxData] = useState<any>(null);
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [tab, startDate, endDate, year]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'pl') {
        const d = await reportsAPI.profitLoss(startDate, endDate);
        setPlData(d);
      } else if (tab === 'expenses') {
        const d = await reportsAPI.expensesByCategory(startDate, endDate);
        setExpenseData(d);
      } else if (tab === 'tax') {
        const d = await reportsAPI.taxSummary(year);
        setTaxData(d);
      } else if (tab === 'monthly') {
        const d = await reportsAPI.monthlySummary(year);
        setMonthlyData(d);
      }
    } catch {
      setError('Could not load report. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { key: 'pl', label: '📈 Profit & Loss' },
    { key: 'expenses', label: '🥧 Expenses by Category' },
    { key: 'monthly', label: '📅 Monthly Trend' },
    { key: 'tax', label: '🇨🇦 Tax Summary' },
  ] as const;

  return (
    <div className="px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Reports</h1>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              tab === t.key ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Date Controls */}
      <div className="flex flex-wrap gap-4 items-end bg-white rounded-xl p-4 border shadow-sm">
        {(tab === 'pl' || tab === 'expenses') ? (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm" />
            </div>
          </>
        ) : (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tax Year</label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="border rounded-lg px-3 py-1.5 text-sm">
              {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}
        <button
          onClick={loadData}
          className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm">⚠️ {error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <>
          {/* Profit & Loss */}
          {tab === 'pl' && plData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard label="Total Revenue" value={`$${plData.revenue.total.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`} color="green" />
                <StatCard label="Total Expenses" value={`$${plData.expenses.total.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`} color="red" />
                <StatCard
                  label="Net Income"
                  value={`$${Math.abs(plData.net_income).toLocaleString('en-CA', { minimumFractionDigits: 2 })}`}
                  color={plData.net_income >= 0 ? 'green' : 'red'}
                  subtitle={`${plData.profit_margin}% margin`}
                />
              </div>

              <div className="bg-white rounded-xl border shadow-sm p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Expenses by Category</h2>
                {Object.keys(plData.expenses.by_category).length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No expense data for this period</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(plData.expenses.by_category)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .map(([cat, amt]) => (
                        <div key={cat} className="flex items-center gap-3">
                          <span className="text-sm text-gray-600 w-40 shrink-0 capitalize">{cat.replace(/_/g, ' ')}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div
                              className="bg-indigo-500 h-2 rounded-full"
                              style={{ width: `${Math.min(((amt as number) / plData.expenses.total) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-gray-900 w-24 text-right">
                            ${(amt as number).toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Expenses Pie */}
          {tab === 'expenses' && expenseData && (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-6">Expense Breakdown</h2>
              {expenseData.categories.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No expense data for this period</p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={expenseData.categories}
                        dataKey="total"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={120}
                        label={({ name, percentage }) => `${(name as string).replace(/_/g, ' ')}: ${percentage}%`}
                      >
                        {expenseData.categories.map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => `$${(v as number).toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {expenseData.categories.map((cat: any, i: number) => (
                      <div key={cat.category} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: COLORS[i % COLORS.length] }}
                          />
                          <span className="text-sm text-gray-700 capitalize">{cat.category.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold">${cat.total.toFixed(2)}</span>
                          <span className="text-xs text-gray-400 ml-2">({cat.percentage}%)</span>
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-2 flex justify-between font-semibold text-sm mt-2">
                      <span>Total</span>
                      <span>${expenseData.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Monthly Bar Chart */}
          {tab === 'monthly' && monthlyData && (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 mb-6">Monthly Revenue vs Expenses — {year}</h2>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={monthlyData.months} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month_name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `$${v.toLocaleString()}`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => `$${(v as number).toLocaleString('en-CA', { minimumFractionDigits: 2 })}`} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#f97316" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="net_income" name="Net Income" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-3 gap-4 mt-6">
                <StatCard label="Annual Revenue" value={`$${monthlyData.totals.revenue.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`} color="green" />
                <StatCard label="Annual Expenses" value={`$${monthlyData.totals.expenses.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`} color="red" />
                <StatCard label="Annual Net Income" value={`$${monthlyData.totals.net_income.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`} color={monthlyData.totals.net_income >= 0 ? 'green' : 'red'} />
              </div>
            </div>
          )}

          {/* Canadian Tax Summary */}
          {tab === 'tax' && taxData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard label="Total Revenue" value={`$${taxData.revenue.total.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`} color="green" />
                <StatCard label="Deductible Expenses" value={`$${taxData.expenses.deductible.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`} color="blue" />
                <StatCard label="Taxable Income" value={`$${taxData.taxable_income.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`} color="indigo" />
              </div>

              {/* GST/HST */}
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <h2 className="font-semibold text-gray-900 mb-4">🍁 GST / HST Summary</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-sm text-green-600 font-medium">GST/HST Collected</p>
                    <p className="text-2xl font-bold text-green-700 mt-1">
                      ${taxData.gst_hst.collected.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-green-600 mt-1">From sales to customers</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-blue-600 font-medium">Input Tax Credits (ITC)</p>
                    <p className="text-2xl font-bold text-blue-700 mt-1">
                      ${taxData.gst_hst.paid.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">GST/HST paid on purchases</p>
                  </div>
                  <div className={`rounded-lg p-4 ${taxData.gst_hst.net_owing >= 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                    <p className={`text-sm font-medium ${taxData.gst_hst.net_owing >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {taxData.gst_hst.net_owing >= 0 ? 'Net Amount Owing to CRA' : 'Refund from CRA'}
                    </p>
                    <p className={`text-2xl font-bold mt-1 ${taxData.gst_hst.net_owing >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                      ${Math.abs(taxData.gst_hst.net_owing).toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                    </p>
                    <p className={`text-xs mt-1 ${taxData.gst_hst.net_owing >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {taxData.gst_hst.note}
                    </p>
                  </div>
                </div>
              </div>

              {/* Non-deductible */}
              <div className="bg-white rounded-xl border shadow-sm p-6">
                <h2 className="font-semibold text-gray-900 mb-2">Expense Summary</h2>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Deductible Expenses</span>
                    <span className="font-semibold text-gray-900">${taxData.expenses.deductible.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Non-deductible Expenses</span>
                    <span className="font-semibold text-gray-900">${taxData.expenses.non_deductible.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-3 font-semibold">
                    <span>Total Expenses</span>
                    <span>${taxData.expenses.total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-indigo-50 rounded-lg">
                  <p className="text-sm font-semibold text-indigo-900">💡 Tax Tip</p>
                  <p className="text-sm text-indigo-700 mt-1">
                    Your estimated taxable income for {taxData.tax_year} is{' '}
                    <strong>${taxData.taxable_income.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</strong>.
                    Talk to a CPA about income splitting, RRSP contributions, and other strategies to reduce your tax burden.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color = 'indigo',
  subtitle,
}: {
  label: string;
  value: string;
  color?: 'green' | 'red' | 'blue' | 'indigo';
  subtitle?: string;
}) {
  const colors = {
    green: 'text-green-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    indigo: 'text-indigo-600',
  };
  return (
    <div className="bg-white rounded-xl border shadow-sm p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${colors[color]}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}
