import { useEffect, useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart as PieChartIcon,
  BarChart3,
  FileText,
  RefreshCw,
  Calendar,
  AlertCircle,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Receipt,
  Landmark,
  ShieldCheck,
  ShieldX,
  Info,
} from 'lucide-react';
import { reportsAPI } from '../services/api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHART_COLORS = [
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#f97316', // orange
  '#ec4899', // pink
];

const BAR_COLORS = {
  revenue: '#6366f1',
  expenses: '#f43f5e',
  net_income: '#10b981',
};

const CURRENT_YEAR = new Date().getFullYear();

type TabKey = 'pl' | 'expenses' | 'monthly' | 'tax';

interface Tab {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  { key: 'pl', label: 'Profit & Loss', icon: <TrendingUp className="w-4 h-4" /> },
  { key: 'expenses', label: 'Expenses by Category', icon: <PieChartIcon className="w-4 h-4" /> },
  { key: 'monthly', label: 'Monthly Trend', icon: <BarChart3 className="w-4 h-4" /> },
  { key: 'tax', label: 'Tax Summary', icon: <FileText className="w-4 h-4" /> },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCAD(value: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
  }).format(value);
}

function formatCompactCAD(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return formatCAD(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function categoryLabel(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  accent = 'indigo',
  subtitle,
  icon,
}: {
  label: string;
  value: string;
  accent?: 'indigo' | 'emerald' | 'rose' | 'amber' | 'sky' | 'violet';
  subtitle?: string;
  icon?: React.ReactNode;
}) {
  const accentMap: Record<string, { border: string; text: string; iconBg: string; iconText: string }> = {
    indigo: { border: 'border-l-indigo-500', text: 'text-indigo-700', iconBg: 'bg-indigo-50', iconText: 'text-indigo-500' },
    emerald: { border: 'border-l-emerald-500', text: 'text-emerald-700', iconBg: 'bg-emerald-50', iconText: 'text-emerald-500' },
    rose: { border: 'border-l-rose-500', text: 'text-rose-700', iconBg: 'bg-rose-50', iconText: 'text-rose-500' },
    amber: { border: 'border-l-amber-500', text: 'text-amber-700', iconBg: 'bg-amber-50', iconText: 'text-amber-500' },
    sky: { border: 'border-l-sky-500', text: 'text-sky-700', iconBg: 'bg-sky-50', iconText: 'text-sky-500' },
    violet: { border: 'border-l-violet-500', text: 'text-violet-700', iconBg: 'bg-violet-50', iconText: 'text-violet-500' },
  };

  const a = accentMap[accent];

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 ${a.border} transition hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 truncate">{label}</p>
          <p className={`text-2xl font-bold mt-1 tracking-tight ${a.text}`}>{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        {icon && (
          <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${a.iconBg} flex items-center justify-center ${a.iconText}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

function ChartContainer({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100">
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <BarChart3 className="w-12 h-12 mb-3 stroke-1" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      <p className="text-sm text-slate-500 mt-3">Loading report data...</p>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
      <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-amber-800">Report Unavailable</p>
        <p className="text-sm text-amber-700 mt-0.5">{message}</p>
      </div>
    </div>
  );
}

// Custom tooltip for charts
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-sm">
      <p className="font-medium text-slate-700 mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-500">{entry.name}:</span>
          <span className="font-semibold text-slate-800">{formatCAD(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-sm">
      <p className="font-medium text-slate-700">{categoryLabel(d.name)}</p>
      <p className="text-slate-800 font-semibold mt-0.5">{formatCAD(d.value)}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Content: Profit & Loss
// ---------------------------------------------------------------------------

function ProfitLossTab({ data }: { data: any }) {
  if (!data) return <EmptyState message="No profit & loss data available." />;

  const revenueTotal = data.revenue?.total ?? data.revenue ?? 0;
  const expensesTotal = data.expenses?.total ?? data.expenses ?? 0;
  const netIncome = data.net_income ?? 0;
  const profitMargin = data.profit_margin ?? (revenueTotal > 0 ? ((netIncome / revenueTotal) * 100) : 0);
  const expenseBreakdown: Record<string, number> =
    data.expenses?.by_category ?? data.expense_breakdown ?? {};

  const breakdownEntries = Object.entries(expenseBreakdown).sort(
    ([, a], [, b]) => (b as number) - (a as number),
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Revenue"
          value={formatCAD(revenueTotal)}
          accent="emerald"
          icon={<ArrowUpRight className="w-5 h-5" />}
        />
        <StatCard
          label="Total Expenses"
          value={formatCAD(expensesTotal)}
          accent="rose"
          icon={<ArrowDownRight className="w-5 h-5" />}
        />
        <StatCard
          label="Net Income"
          value={formatCAD(netIncome)}
          accent={netIncome >= 0 ? 'emerald' : 'rose'}
          subtitle={`${formatPercent(profitMargin)} profit margin`}
          icon={netIncome >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
        />
      </div>

      {/* Expense Breakdown */}
      <ChartContainer title="Expense Breakdown" subtitle="Sorted by amount, highest first">
        {breakdownEntries.length === 0 ? (
          <EmptyState message="No expense data for this period." />
        ) : (
          <div className="space-y-3">
            {breakdownEntries.map(([cat, amt], idx) => {
              const pct = expensesTotal > 0 ? ((amt as number) / expensesTotal) * 100 : 0;
              return (
                <div key={cat} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                      />
                      <span className="text-sm text-slate-600 font-medium">{categoryLabel(cat)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">{formatPercent(pct)}</span>
                      <span className="text-sm font-semibold text-slate-800 w-28 text-right">
                        {formatCAD(amt as number)}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {/* Total row */}
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-200">
              <span className="text-sm font-semibold text-slate-700">Total Expenses</span>
              <span className="text-sm font-bold text-slate-900">{formatCAD(expensesTotal)}</span>
            </div>
          </div>
        )}
      </ChartContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Content: Expenses by Category
// ---------------------------------------------------------------------------

function ExpensesCategoryTab({ data }: { data: any }) {
  if (!data || !data.categories || data.categories.length === 0) {
    return <EmptyState message="No expense data for this period." />;
  }

  const total = data.total ?? data.categories.reduce((s: number, c: any) => s + (c.total ?? c.amount ?? 0), 0);

  return (
    <ChartContainer title="Expense Distribution" subtitle="Visual breakdown of spending by category">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Pie Chart */}
        <div>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={data.categories}
                dataKey="total"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={130}
                paddingAngle={2}
                strokeWidth={2}
                stroke="#fff"
              >
                {data.categories.map((_: any, i: number) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend Table */}
        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                <th className="text-right py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="text-right py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">%</th>
              </tr>
            </thead>
            <tbody>
              {data.categories.map((cat: any, i: number) => (
                <tr key={cat.category} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="text-slate-700 font-medium">{categoryLabel(cat.category)}</span>
                    </div>
                  </td>
                  <td className="text-right py-2.5 font-semibold text-slate-800">
                    {formatCAD(cat.total ?? cat.amount ?? 0)}
                  </td>
                  <td className="text-right py-2.5 text-slate-500">
                    {formatPercent(cat.percentage ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200">
                <td className="py-3 font-bold text-slate-800">Total</td>
                <td className="text-right py-3 font-bold text-slate-900">{formatCAD(total)}</td>
                <td className="text-right py-3 font-bold text-slate-500">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </ChartContainer>
  );
}

// ---------------------------------------------------------------------------
// Tab Content: Monthly Trend
// ---------------------------------------------------------------------------

function MonthlyTrendTab({ data, year }: { data: any; year: number }) {
  if (!data || !data.months || data.months.length === 0) {
    return <EmptyState message="No monthly data available for this year." />;
  }

  return (
    <div className="space-y-6">
      {/* Annual Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Annual Revenue"
          value={formatCAD(data.totals?.revenue ?? 0)}
          accent="indigo"
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          label="Annual Expenses"
          value={formatCAD(data.totals?.expenses ?? 0)}
          accent="rose"
          icon={<Receipt className="w-5 h-5" />}
        />
        <StatCard
          label="Annual Net Income"
          value={formatCAD(data.totals?.net_income ?? 0)}
          accent={data.totals?.net_income >= 0 ? 'emerald' : 'rose'}
          icon={data.totals?.net_income >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
        />
      </div>

      {/* Bar Chart */}
      <ChartContainer
        title={`Monthly Revenue vs. Expenses - ${year}`}
        subtitle="Side-by-side comparison for each month"
      >
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data.months} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="month_name"
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={{ stroke: '#cbd5e1' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => formatCompactCAD(v)}
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '13px', paddingTop: '16px' }}
            />
            <Bar dataKey="revenue" name="Revenue" fill={BAR_COLORS.revenue} radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar dataKey="expenses" name="Expenses" fill={BAR_COLORS.expenses} radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar dataKey="net_income" name="Net Income" fill={BAR_COLORS.net_income} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Content: Tax Summary
// ---------------------------------------------------------------------------

function TaxSummaryTab({ data }: { data: any }) {
  if (!data) return <EmptyState message="No tax data available." />;

  const revenueTotal = data.revenue?.total ?? data.revenue ?? 0;
  const deductible = data.expenses?.deductible ?? data.deductible_expenses ?? 0;
  const nonDeductible = data.expenses?.non_deductible ?? data.non_deductible_expenses ?? 0;
  const totalExpenses = data.expenses?.total ?? deductible + nonDeductible;
  const taxableIncome = data.taxable_income ?? 0;

  const gstCollected = data.gst_hst?.collected ?? 0;
  const gstCredits = data.gst_hst?.paid ?? data.gst_hst?.input_credits ?? 0;
  const gstNetOwing = data.gst_hst?.net_owing ?? gstCollected - gstCredits;
  const gstNote = data.gst_hst?.note ?? '';

  const taxYear = data.tax_year ?? CURRENT_YEAR;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Total Revenue"
          value={formatCAD(revenueTotal)}
          accent="emerald"
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          label="Deductible Expenses"
          value={formatCAD(deductible)}
          accent="sky"
          icon={<ShieldCheck className="w-5 h-5" />}
        />
        <StatCard
          label="Taxable Income"
          value={formatCAD(taxableIncome)}
          accent="indigo"
          icon={<Landmark className="w-5 h-5" />}
        />
      </div>

      {/* GST/HST Section */}
      <ChartContainer title="GST / HST Summary" subtitle="Goods and Services Tax obligations for the year">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Collected */}
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-5">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-700">GST/HST Collected</p>
            </div>
            <p className="text-2xl font-bold text-emerald-800">{formatCAD(gstCollected)}</p>
            <p className="text-xs text-emerald-600 mt-1.5">From sales to customers</p>
          </div>

          {/* Input Tax Credits */}
          <div className="rounded-xl bg-sky-50 border border-sky-100 p-5">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownRight className="w-4 h-4 text-sky-600" />
              <p className="text-sm font-semibold text-sky-700">Input Tax Credits (ITC)</p>
            </div>
            <p className="text-2xl font-bold text-sky-800">{formatCAD(gstCredits)}</p>
            <p className="text-xs text-sky-600 mt-1.5">GST/HST paid on purchases</p>
          </div>

          {/* Net Owing / Refund */}
          <div
            className={`rounded-xl border p-5 ${
              gstNetOwing >= 0
                ? 'bg-rose-50 border-rose-100'
                : 'bg-emerald-50 border-emerald-100'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {gstNetOwing >= 0 ? (
                <Minus className="w-4 h-4 text-rose-600" />
              ) : (
                <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              )}
              <p
                className={`text-sm font-semibold ${
                  gstNetOwing >= 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}
              >
                {gstNetOwing >= 0 ? 'Net Amount Owing to CRA' : 'Refund from CRA'}
              </p>
            </div>
            <p
              className={`text-2xl font-bold ${
                gstNetOwing >= 0 ? 'text-rose-800' : 'text-emerald-800'
              }`}
            >
              {formatCAD(Math.abs(gstNetOwing))}
            </p>
            {gstNote && (
              <p
                className={`text-xs mt-1.5 ${
                  gstNetOwing >= 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {gstNote}
              </p>
            )}
          </div>
        </div>
      </ChartContainer>

      {/* Expense Deductibility Breakdown */}
      <ChartContainer title="Expense Deductibility" subtitle="Breakdown of deductible vs. non-deductible expenses">
        <div className="space-y-4">
          {/* Visual bar */}
          {totalExpenses > 0 && (
            <div className="flex rounded-full h-4 overflow-hidden bg-slate-100">
              <div
                className="bg-indigo-500 transition-all duration-500"
                style={{ width: `${(deductible / totalExpenses) * 100}%` }}
              />
              <div
                className="bg-slate-300 transition-all duration-500"
                style={{ width: `${(nonDeductible / totalExpenses) * 100}%` }}
              />
            </div>
          )}

          {/* Legend for visual bar */}
          <div className="flex gap-6 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              Deductible ({totalExpenses > 0 ? formatPercent((deductible / totalExpenses) * 100) : '0%'})
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              Non-deductible ({totalExpenses > 0 ? formatPercent((nonDeductible / totalExpenses) * 100) : '0%'})
            </div>
          </div>

          {/* Line items */}
          <div className="divide-y divide-slate-100">
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2 text-slate-600">
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-medium">Deductible Expenses</span>
              </div>
              <span className="text-sm font-semibold text-slate-800">{formatCAD(deductible)}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2 text-slate-600">
                <ShieldX className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium">Non-deductible Expenses</span>
              </div>
              <span className="text-sm font-semibold text-slate-800">{formatCAD(nonDeductible)}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm font-bold text-slate-800">Total Expenses</span>
              <span className="text-sm font-bold text-slate-900">{formatCAD(totalExpenses)}</span>
            </div>
          </div>
        </div>
      </ChartContainer>

      {/* Tax Tip */}
      <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-5">
        <Info className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-indigo-900">Tax Planning Tip</p>
          <p className="text-sm text-indigo-700 mt-1 leading-relaxed">
            Your estimated taxable income for {taxYear} is{' '}
            <strong>{formatCAD(taxableIncome)}</strong>. Consider speaking with a CPA about
            income-splitting strategies, RRSP contributions, and other approaches to optimize your
            tax position.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function Reports() {
  const [activeTab, setActiveTab] = useState<TabKey>('pl');
  const [year, setYear] = useState(CURRENT_YEAR);
  const [startDate, setStartDate] = useState(`${CURRENT_YEAR}-01-01`);
  const [endDate, setEndDate] = useState(`${CURRENT_YEAR}-12-31`);

  const [plData, setPlData] = useState<any>(null);
  const [expenseData, setExpenseData] = useState<any>(null);
  const [taxData, setTaxData] = useState<any>(null);
  const [monthlyData, setMonthlyData] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'pl') {
        const d = await reportsAPI.profitLoss(startDate, endDate);
        setPlData(d);
      } else if (activeTab === 'expenses') {
        const d = await reportsAPI.expensesByCategory(startDate, endDate);
        setExpenseData(d);
      } else if (activeTab === 'tax') {
        const d = await reportsAPI.taxSummary(year);
        setTaxData(d);
      } else if (activeTab === 'monthly') {
        const d = await reportsAPI.monthlySummary(year);
        setMonthlyData(d);
      }
    } catch {
      setError('Could not load report data. Please ensure the backend is running and try again.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, startDate, endDate, year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const usesDateRange = activeTab === 'pl' || activeTab === 'expenses';

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reports</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Financial insights and summaries for your business
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200">
          <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Report tabs">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    isActive
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Date / Year Controls */}
        <div className="flex flex-wrap items-end gap-4 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          {usesDateRange ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Start Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  End Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Year
              </label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition bg-white min-w-[100px]"
              >
                {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && <ErrorBanner message={error} />}

        {/* Content */}
        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            {activeTab === 'pl' && <ProfitLossTab data={plData} />}
            {activeTab === 'expenses' && <ExpensesCategoryTab data={expenseData} />}
            {activeTab === 'monthly' && <MonthlyTrendTab data={monthlyData} year={year} />}
            {activeTab === 'tax' && <TaxSummaryTab data={taxData} />}
          </>
        )}
      </div>
    </div>
  );
}
