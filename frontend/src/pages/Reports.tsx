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
  Scale,
  Table2,
  BookOpen,
  Clock,
  Calculator,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { reportsAPI, accountAPI } from '../services/api';

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

type TabKey = 'pl' | 'expenses' | 'monthly' | 'tax' | 'balance_sheet' | 'trial_balance' | 'general_ledger' | 'ar_aging' | 'gst' | 't2125';

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
  { key: 'balance_sheet', label: 'Balance Sheet', icon: <Scale className="w-4 h-4" /> },
  { key: 'trial_balance', label: 'Trial Balance', icon: <Table2 className="w-4 h-4" /> },
  { key: 'general_ledger', label: 'General Ledger', icon: <BookOpen className="w-4 h-4" /> },
  { key: 'ar_aging', label: 'AR Aging', icon: <Clock className="w-4 h-4" /> },
  { key: 'gst', label: 'GST Worksheet', icon: <Calculator className="w-4 h-4" /> },
  { key: 't2125', label: 'T2125', icon: <FileSpreadsheet className="w-4 h-4" /> },
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

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
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

function BalancedIndicator({ isBalanced }: { isBalanced: boolean }) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
        isBalanced
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : 'bg-rose-50 text-rose-700 border border-rose-200'
      }`}
    >
      {isBalanced ? (
        <CheckCircle2 className="w-3.5 h-3.5" />
      ) : (
        <XCircle className="w-3.5 h-3.5" />
      )}
      {isBalanced ? 'Balanced' : 'Unbalanced'}
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
// Tab Content: Balance Sheet
// ---------------------------------------------------------------------------

function BalanceSheetTab({ data }: { data: any }) {
  if (!data) return <EmptyState message="No balance sheet data available." />;

  const totals = data.totals ?? {};
  const sections = data.sections ?? data;

  // Extract section data -- API may nest under assets/liabilities/equity
  const assetAccounts: any[] = [];
  const liabilityAccounts: any[] = [];
  const equityAccounts: any[] = [];

  // Assets: could be sections.assets or sections with account_type containing 'asset'
  if (sections.assets) {
    const assets = sections.assets;
    if (assets.current_assets) assetAccounts.push(...(assets.current_assets.accounts ?? assets.current_assets ?? []));
    if (assets.fixed_assets) assetAccounts.push(...(assets.fixed_assets.accounts ?? assets.fixed_assets ?? []));
    if (assets.accounts) assetAccounts.push(...assets.accounts);
    // Fallback: if assets is an array directly
    if (Array.isArray(assets)) assetAccounts.push(...assets);
  }
  if (sections.liabilities) {
    const liab = sections.liabilities;
    if (liab.current_liabilities) liabilityAccounts.push(...(liab.current_liabilities.accounts ?? liab.current_liabilities ?? []));
    if (liab.accounts) liabilityAccounts.push(...liab.accounts);
    if (Array.isArray(liab)) liabilityAccounts.push(...liab);
  }
  if (sections.equity) {
    const eq = sections.equity;
    if (eq.accounts) equityAccounts.push(...eq.accounts);
    if (Array.isArray(eq)) equityAccounts.push(...eq);
  }

  const totalAssets = totals.total_assets ?? 0;
  const totalLiabilities = totals.total_liabilities ?? 0;
  const totalEquity = totals.total_equity ?? 0;
  const isBalanced = totals.is_balanced ?? (Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01);

  const renderAccountTable = (accounts: any[], sectionTotal: number, sectionLabel: string) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-800">{sectionLabel}</h4>
        <span className="text-sm font-bold text-slate-700 tabular-nums">{formatCAD(sectionTotal)}</span>
      </div>
      {accounts.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-slate-400">No accounts in this section.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="text-left px-6 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Code</th>
              <th className="text-left px-6 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Account Name</th>
              <th className="text-right px-6 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Balance</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((acct: any, i: number) => (
              <tr key={acct.account_id ?? acct.id ?? i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="px-6 py-2.5 text-slate-500 font-mono text-xs">{acct.code ?? acct.account_code ?? '-'}</td>
                <td className="px-6 py-2.5 text-slate-700 font-medium">{acct.name ?? acct.account_name ?? '-'}</td>
                <td className="px-6 py-2.5 text-right font-semibold text-slate-800 tabular-nums">{formatCAD(acct.balance ?? 0)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50/50">
              <td colSpan={2} className="px-6 py-3 text-sm font-bold text-slate-700">Total {sectionLabel}</td>
              <td className="px-6 py-3 text-right text-sm font-bold text-slate-900 tabular-nums">{formatCAD(sectionTotal)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Totals Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Assets"
          value={formatCAD(totalAssets)}
          accent="indigo"
          icon={<Scale className="w-5 h-5" />}
        />
        <StatCard
          label="Total Liabilities"
          value={formatCAD(totalLiabilities)}
          accent="rose"
          icon={<ArrowDownRight className="w-5 h-5" />}
        />
        <StatCard
          label="Total Equity"
          value={formatCAD(totalEquity)}
          accent="emerald"
          icon={<Landmark className="w-5 h-5" />}
        />
      </div>

      {/* Balance Indicator */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div>
          <p className="text-sm font-semibold text-slate-700">Accounting Equation</p>
          <p className="text-xs text-slate-500 mt-0.5">Assets = Liabilities + Equity</p>
          <p className="text-sm text-slate-600 mt-2 tabular-nums">
            {formatCAD(totalAssets)} = {formatCAD(totalLiabilities)} + {formatCAD(totalEquity)}
          </p>
        </div>
        <BalancedIndicator isBalanced={isBalanced} />
      </div>

      {/* Section Tables */}
      {renderAccountTable(assetAccounts, totalAssets, 'Assets')}
      {renderAccountTable(liabilityAccounts, totalLiabilities, 'Liabilities')}
      {renderAccountTable(equityAccounts, totalEquity, 'Equity')}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Content: Trial Balance
// ---------------------------------------------------------------------------

function TrialBalanceTab({ data }: { data: any }) {
  if (!data) return <EmptyState message="No trial balance data available." />;

  const accounts: any[] = data.accounts ?? data.entries ?? [];
  const totals = data.totals ?? {};
  const totalDebit = totals.total_debits ?? totals.total_debit ?? 0;
  const totalCredit = totals.total_credits ?? totals.total_credit ?? 0;
  const isBalanced = totals.is_balanced ?? (Math.abs(totalDebit - totalCredit) < 0.01);

  return (
    <div className="space-y-6">
      {/* Balance Indicator */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Debits</p>
            <p className="text-xl font-bold text-slate-800 tabular-nums mt-0.5">{formatCAD(totalDebit)}</p>
          </div>
          <div className="text-slate-300 text-lg font-light">=</div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Credits</p>
            <p className="text-xl font-bold text-slate-800 tabular-nums mt-0.5">{formatCAD(totalCredit)}</p>
          </div>
        </div>
        <BalancedIndicator isBalanced={isBalanced} />
      </div>

      {/* Trial Balance Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">Trial Balance</h3>
          <p className="text-sm text-slate-500 mt-0.5">All accounts with their debit and credit balances</p>
        </div>
        {accounts.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">No accounts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-6 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Code</th>
                  <th className="text-left px-6 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Account Name</th>
                  <th className="text-left px-6 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="text-right px-6 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Debit</th>
                  <th className="text-right px-6 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Credit</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acct: any, i: number) => (
                  <tr key={acct.account_id ?? acct.id ?? i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-2.5 text-slate-500 font-mono text-xs">{acct.code ?? acct.account_code ?? '-'}</td>
                    <td className="px-6 py-2.5 text-slate-700 font-medium">{acct.name ?? acct.account_name ?? '-'}</td>
                    <td className="px-6 py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        {categoryLabel(acct.account_type ?? acct.type ?? '-')}
                      </span>
                    </td>
                    <td className="px-6 py-2.5 text-right font-semibold text-slate-800 tabular-nums">
                      {(acct.debit ?? 0) > 0 ? formatCAD(acct.debit) : '-'}
                    </td>
                    <td className="px-6 py-2.5 text-right font-semibold text-slate-800 tabular-nums">
                      {(acct.credit ?? 0) > 0 ? formatCAD(acct.credit) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/50">
                  <td colSpan={3} className="px-6 py-3 text-sm font-bold text-slate-700">Totals</td>
                  <td className="px-6 py-3 text-right text-sm font-bold text-slate-900 tabular-nums">{formatCAD(totalDebit)}</td>
                  <td className="px-6 py-3 text-right text-sm font-bold text-slate-900 tabular-nums">{formatCAD(totalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Content: General Ledger
// ---------------------------------------------------------------------------

function GeneralLedgerTab({ data }: { data: any }) {
  if (!data) return <EmptyState message="Select an account and date range, then click Refresh to load the general ledger." />;

  const entries: any[] = data.entries ?? data.lines ?? [];
  const openingBalance = data.opening_balance ?? 0;
  const closingBalance = data.closing_balance ?? 0;
  const accountName = data.account_name ?? data.account?.name ?? 'Account';

  return (
    <div className="space-y-6">
      {/* Opening / Closing balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="Opening Balance"
          value={formatCAD(openingBalance)}
          accent="sky"
          icon={<BookOpen className="w-5 h-5" />}
          subtitle={accountName}
        />
        <StatCard
          label="Closing Balance"
          value={formatCAD(closingBalance)}
          accent="indigo"
          icon={<BookOpen className="w-5 h-5" />}
          subtitle={`${entries.length} entries`}
        />
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">Ledger Entries</h3>
          <p className="text-sm text-slate-500 mt-0.5">{accountName}</p>
        </div>
        {entries.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">No entries found for this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-6 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="text-left px-6 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                  <th className="text-left px-6 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reference</th>
                  <th className="text-right px-6 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Debit</th>
                  <th className="text-right px-6 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Credit</th>
                  <th className="text-right px-6 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Balance</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening balance row */}
                <tr className="border-b border-slate-100 bg-slate-50/30">
                  <td className="px-6 py-2.5 text-slate-500 text-xs" colSpan={3}>
                    <span className="font-semibold text-slate-600">Opening Balance</span>
                  </td>
                  <td className="px-6 py-2.5" />
                  <td className="px-6 py-2.5" />
                  <td className="px-6 py-2.5 text-right font-semibold text-slate-700 tabular-nums">{formatCAD(openingBalance)}</td>
                </tr>
                {entries.map((entry: any, i: number) => (
                  <tr key={entry.id ?? i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-2.5 text-slate-500 text-xs whitespace-nowrap">{entry.date ?? '-'}</td>
                    <td className="px-6 py-2.5 text-slate-700 font-medium max-w-xs truncate">{entry.description ?? entry.memo ?? '-'}</td>
                    <td className="px-6 py-2.5 text-slate-500 text-xs font-mono">{entry.reference ?? entry.ref ?? '-'}</td>
                    <td className="px-6 py-2.5 text-right font-semibold text-slate-800 tabular-nums">
                      {(entry.debit ?? 0) > 0 ? formatCAD(entry.debit) : '-'}
                    </td>
                    <td className="px-6 py-2.5 text-right font-semibold text-slate-800 tabular-nums">
                      {(entry.credit ?? 0) > 0 ? formatCAD(entry.credit) : '-'}
                    </td>
                    <td className="px-6 py-2.5 text-right font-semibold text-slate-800 tabular-nums">
                      {formatCAD(entry.running_balance ?? entry.balance ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/50">
                  <td colSpan={3} className="px-6 py-3 text-sm font-bold text-slate-700">Closing Balance</td>
                  <td className="px-6 py-3" />
                  <td className="px-6 py-3" />
                  <td className="px-6 py-3 text-right text-sm font-bold text-slate-900 tabular-nums">{formatCAD(closingBalance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Content: AR Aging
// ---------------------------------------------------------------------------

function ARAgingTab({ data }: { data: any }) {
  if (!data) return <EmptyState message="No AR aging data available." />;

  const buckets = data.buckets ?? data.summary ?? {};
  const totalOutstanding = data.total_outstanding ?? data.total ?? 0;
  const invoices: any[] = data.invoices ?? data.details ?? [];

  const bucketCurrent = buckets.current ?? 0;
  const bucket30 = buckets['1_30'] ?? buckets.days_30 ?? buckets['30_days'] ?? 0;
  const bucket60 = buckets['31_60'] ?? buckets.days_60 ?? buckets['60_days'] ?? 0;
  const bucket90 = buckets['61_90'] ?? buckets.days_90 ?? buckets['90_plus'] ?? buckets['90_days'] ?? 0;

  // Group invoices by bucket for the table
  const groupedInvoices: Record<string, any[]> = {};
  invoices.forEach((inv: any) => {
    const bucket = inv.bucket ?? inv.aging_bucket ?? 'current';
    if (!groupedInvoices[bucket]) groupedInvoices[bucket] = [];
    groupedInvoices[bucket].push(inv);
  });

  return (
    <div className="space-y-6">
      {/* Bucket Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <StatCard
          label="Current"
          value={formatCAD(bucketCurrent)}
          accent="emerald"
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
        <StatCard
          label="1-30 Days"
          value={formatCAD(bucket30)}
          accent="amber"
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          label="31-60 Days"
          value={formatCAD(bucket60)}
          accent="amber"
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          label="61-90+ Days"
          value={formatCAD(bucket90)}
          accent="rose"
          icon={<AlertCircle className="w-5 h-5" />}
        />
        <StatCard
          label="Total Outstanding"
          value={formatCAD(totalOutstanding)}
          accent="indigo"
          icon={<DollarSign className="w-5 h-5" />}
        />
      </div>

      {/* Aging Bar Visual */}
      {totalOutstanding > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3">Aging Distribution</p>
          <div className="flex rounded-full h-4 overflow-hidden bg-slate-100">
            {bucketCurrent > 0 && (
              <div
                className="bg-emerald-500 transition-all duration-500"
                style={{ width: `${(bucketCurrent / totalOutstanding) * 100}%` }}
                title={`Current: ${formatCAD(bucketCurrent)}`}
              />
            )}
            {bucket30 > 0 && (
              <div
                className="bg-amber-400 transition-all duration-500"
                style={{ width: `${(bucket30 / totalOutstanding) * 100}%` }}
                title={`1-30 Days: ${formatCAD(bucket30)}`}
              />
            )}
            {bucket60 > 0 && (
              <div
                className="bg-amber-600 transition-all duration-500"
                style={{ width: `${(bucket60 / totalOutstanding) * 100}%` }}
                title={`31-60 Days: ${formatCAD(bucket60)}`}
              />
            )}
            {bucket90 > 0 && (
              <div
                className="bg-rose-500 transition-all duration-500"
                style={{ width: `${(bucket90 / totalOutstanding) * 100}%` }}
                title={`61-90+ Days: ${formatCAD(bucket90)}`}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Current
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              1-30 Days
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
              31-60 Days
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              61-90+ Days
            </div>
          </div>
        </div>
      )}

      {/* Invoice Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">Outstanding Invoices</h3>
          <p className="text-sm text-slate-500 mt-0.5">{invoices.length} invoices outstanding</p>
        </div>
        {invoices.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">No outstanding invoices.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-6 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Invoice #</th>
                  <th className="text-left px-6 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="text-left px-6 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="text-left px-6 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Due Date</th>
                  <th className="text-right px-6 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Days Past Due</th>
                  <th className="text-left px-6 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Bucket</th>
                  <th className="text-right px-6 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any, i: number) => {
                  const bucket = inv.bucket ?? inv.aging_bucket ?? 'current';
                  const bucketColor = bucket === 'current'
                    ? 'bg-emerald-50 text-emerald-700'
                    : bucket.includes('90') || bucket.includes('61')
                      ? 'bg-rose-50 text-rose-700'
                      : 'bg-amber-50 text-amber-700';
                  return (
                    <tr key={inv.invoice_id ?? inv.id ?? i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-2.5 text-slate-700 font-medium font-mono text-xs">{inv.invoice_number ?? inv.number ?? '-'}</td>
                      <td className="px-6 py-2.5 text-slate-700">{inv.customer_name ?? inv.customer ?? '-'}</td>
                      <td className="px-6 py-2.5 text-slate-500 text-xs">{inv.invoice_date ?? inv.date ?? '-'}</td>
                      <td className="px-6 py-2.5 text-slate-500 text-xs">{inv.due_date ?? '-'}</td>
                      <td className="px-6 py-2.5 text-right text-slate-600 tabular-nums">{inv.days_past_due ?? inv.days_overdue ?? 0}</td>
                      <td className="px-6 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bucketColor}`}>
                          {categoryLabel(bucket)}
                        </span>
                      </td>
                      <td className="px-6 py-2.5 text-right font-semibold text-slate-800 tabular-nums">
                        {formatCAD(inv.amount_due ?? inv.balance ?? inv.amount ?? 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/50">
                  <td colSpan={6} className="px-6 py-3 text-sm font-bold text-slate-700">Total Outstanding</td>
                  <td className="px-6 py-3 text-right text-sm font-bold text-slate-900 tabular-nums">{formatCAD(totalOutstanding)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Content: GST Worksheet
// ---------------------------------------------------------------------------

function GSTWorksheetTab({ data }: { data: any }) {
  if (!data) return <EmptyState message="No GST worksheet data available." />;

  const gstCollected = data.gst_collected ?? data.collected ?? 0;
  const inputTaxCredits = data.input_tax_credits ?? data.itc ?? data.credits ?? 0;
  const netTax = data.net_tax ?? data.net_owing ?? (gstCollected - inputTaxCredits);
  const isRefund = netTax < 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="GST Collected"
          value={formatCAD(gstCollected)}
          accent="emerald"
          icon={<ArrowUpRight className="w-5 h-5" />}
          subtitle="On sales and revenue"
        />
        <StatCard
          label="Input Tax Credits"
          value={formatCAD(inputTaxCredits)}
          accent="sky"
          icon={<ArrowDownRight className="w-5 h-5" />}
          subtitle="GST paid on purchases"
        />
        <StatCard
          label="Net GST"
          value={formatCAD(Math.abs(netTax))}
          accent={isRefund ? 'emerald' : 'rose'}
          icon={isRefund ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          subtitle={isRefund ? 'Refund due from CRA' : 'Amount owing to CRA'}
        />
      </div>

      {/* Net Tax Indicator */}
      <div
        className={`rounded-xl border p-6 ${
          isRefund
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-rose-50 border-rose-200'
        }`}
      >
        <div className="flex items-center gap-3">
          {isRefund ? (
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <ArrowUpRight className="w-6 h-6 text-emerald-600" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center">
              <ArrowDownRight className="w-6 h-6 text-rose-600" />
            </div>
          )}
          <div>
            <p className={`text-lg font-bold ${isRefund ? 'text-emerald-800' : 'text-rose-800'}`}>
              {isRefund ? 'GST Refund' : 'GST Owing'}
            </p>
            <p className={`text-3xl font-bold tabular-nums ${isRefund ? 'text-emerald-900' : 'text-rose-900'}`}>
              {formatCAD(Math.abs(netTax))}
            </p>
            <p className={`text-sm mt-1 ${isRefund ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isRefund
                ? 'You overpaid GST this period and are eligible for a refund.'
                : 'Net GST owing to the Canada Revenue Agency for this period.'}
            </p>
          </div>
        </div>
      </div>

      {/* Calculation Breakdown */}
      <ChartContainer title="GST Calculation" subtitle="Step-by-step breakdown">
        <div className="divide-y divide-slate-100">
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-slate-600">GST Collected on Sales</span>
            <span className="text-sm font-semibold text-slate-800 tabular-nums">{formatCAD(gstCollected)}</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-slate-600">Less: Input Tax Credits (ITC)</span>
            <span className="text-sm font-semibold text-slate-800 tabular-nums">({formatCAD(inputTaxCredits)})</span>
          </div>
          <div className="flex items-center justify-between py-3 border-t-2 border-slate-200">
            <span className="text-sm font-bold text-slate-700">
              {isRefund ? 'Net Refund' : 'Net Tax Owing'}
            </span>
            <span className={`text-sm font-bold tabular-nums ${isRefund ? 'text-emerald-700' : 'text-rose-700'}`}>
              {formatCAD(netTax)}
            </span>
          </div>
        </div>
      </ChartContainer>

      {/* Details table if available */}
      {data.details && Array.isArray(data.details) && data.details.length > 0 && (
        <ChartContainer title="GST Detail Lines" subtitle="Breakdown by category">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                <th className="text-right py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Taxable Amount</th>
                <th className="text-right py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">GST</th>
              </tr>
            </thead>
            <tbody>
              {data.details.map((line: any, i: number) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 text-slate-700 font-medium">{categoryLabel(line.category ?? line.description ?? '-')}</td>
                  <td className="py-2.5 text-right text-slate-800 font-semibold tabular-nums">
                    {formatCAD(line.taxable_amount ?? line.amount ?? 0)}
                  </td>
                  <td className="py-2.5 text-right text-slate-800 font-semibold tabular-nums">
                    {formatCAD(line.gst ?? line.tax ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartContainer>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Content: T2125
// ---------------------------------------------------------------------------

function T2125Tab({ data }: { data: any }) {
  if (!data) return <EmptyState message="No T2125 data available." />;

  const grossIncome = data.gross_income ?? data.income ?? {};
  const grossIncomeTotal = grossIncome.total ?? grossIncome.gross ?? 0;
  const incomeDetails: any[] = grossIncome.details ?? grossIncome.lines ?? [];

  const expenses = data.expenses ?? {};
  const expenseLines: any[] = expenses.lines ?? expenses.details ?? [];
  const totalExpenses = expenses.total ?? 0;

  const netIncome = data.net_income ?? (grossIncomeTotal - totalExpenses);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Gross Business Income"
          value={formatCAD(grossIncomeTotal)}
          accent="emerald"
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          label="Total Business Expenses"
          value={formatCAD(totalExpenses)}
          accent="rose"
          icon={<Receipt className="w-5 h-5" />}
        />
        <StatCard
          label="Net Business Income"
          value={formatCAD(netIncome)}
          accent={netIncome >= 0 ? 'indigo' : 'rose'}
          icon={netIncome >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
          subtitle="Line 8299 minus Line 9369"
        />
      </div>

      {/* Gross Income Section */}
      <ChartContainer title="Part 1 - Gross Business Income" subtitle="CRA T2125 income section">
        {incomeDetails.length === 0 ? (
          <div className="divide-y divide-slate-100">
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-600">Gross Business Income</span>
              <span className="text-sm font-semibold text-slate-800 tabular-nums">{formatCAD(grossIncomeTotal)}</span>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {incomeDetails.map((line: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  {line.line_number && (
                    <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                      L{line.line_number}
                    </span>
                  )}
                  <span className="text-sm text-slate-700 font-medium">{line.description ?? line.name ?? '-'}</span>
                </div>
                <span className="text-sm font-semibold text-slate-800 tabular-nums">{formatCAD(line.amount ?? 0)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-3 border-t-2 border-slate-200">
              <span className="text-sm font-bold text-slate-800">Total Gross Income (Line 8299)</span>
              <span className="text-sm font-bold text-slate-900 tabular-nums">{formatCAD(grossIncomeTotal)}</span>
            </div>
          </div>
        )}
      </ChartContainer>

      {/* Expenses Section */}
      <ChartContainer title="Part 4 - Business Expenses" subtitle="Grouped by CRA T2125 line number">
        {expenseLines.length === 0 ? (
          <div className="divide-y divide-slate-100">
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-600">Total Business Expenses</span>
              <span className="text-sm font-semibold text-slate-800 tabular-nums">{formatCAD(totalExpenses)}</span>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {expenseLines.map((line: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  {line.line_number && (
                    <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                      L{line.line_number}
                    </span>
                  )}
                  <span className="text-sm text-slate-700 font-medium">{line.description ?? line.name ?? '-'}</span>
                </div>
                <span className="text-sm font-semibold text-slate-800 tabular-nums">{formatCAD(line.amount ?? 0)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-3 border-t-2 border-slate-200">
              <span className="text-sm font-bold text-slate-800">Total Expenses (Line 9369)</span>
              <span className="text-sm font-bold text-slate-900 tabular-nums">{formatCAD(totalExpenses)}</span>
            </div>
          </div>
        )}
      </ChartContainer>

      {/* Net Income Banner */}
      <div
        className={`rounded-xl border p-6 ${
          netIncome >= 0
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-rose-50 border-rose-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm font-semibold ${netIncome >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              Net Business Income (Loss)
            </p>
            <p className={`text-xs mt-0.5 ${netIncome >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              Line 8299 minus Line 9369
            </p>
          </div>
          <p className={`text-3xl font-bold tabular-nums ${netIncome >= 0 ? 'text-emerald-900' : 'text-rose-900'}`}>
            {formatCAD(netIncome)}
          </p>
        </div>
      </div>

      {/* Info Note */}
      <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-5">
        <Info className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-indigo-900">T2125 Statement of Business Activities</p>
          <p className="text-sm text-indigo-700 mt-1 leading-relaxed">
            This report maps your income and expenses to CRA T2125 line numbers for your tax return.
            Always verify figures with your accountant before filing.
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
  const [asOfDate, setAsOfDate] = useState(todayISO());
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);

  const [plData, setPlData] = useState<any>(null);
  const [expenseData, setExpenseData] = useState<any>(null);
  const [taxData, setTaxData] = useState<any>(null);
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [balanceSheetData, setBalanceSheetData] = useState<any>(null);
  const [trialBalanceData, setTrialBalanceData] = useState<any>(null);
  const [generalLedgerData, setGeneralLedgerData] = useState<any>(null);
  const [arAgingData, setArAgingData] = useState<any>(null);
  const [gstData, setGstData] = useState<any>(null);
  const [t2125Data, setT2125Data] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load accounts list for the General Ledger dropdown
  useEffect(() => {
    accountAPI.list({ active_only: true }).then(setAccounts).catch(() => {});
  }, []);

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
      } else if (activeTab === 'balance_sheet') {
        const d = await reportsAPI.balanceSheet(asOfDate);
        setBalanceSheetData(d);
      } else if (activeTab === 'trial_balance') {
        const d = await reportsAPI.trialBalance(asOfDate);
        setTrialBalanceData(d);
      } else if (activeTab === 'general_ledger') {
        if (!selectedAccountId) {
          setError('Please select an account to view the general ledger.');
          setLoading(false);
          return;
        }
        const d = await reportsAPI.generalLedger(selectedAccountId, startDate, endDate);
        setGeneralLedgerData(d);
      } else if (activeTab === 'ar_aging') {
        const d = await reportsAPI.arAging();
        setArAgingData(d);
      } else if (activeTab === 'gst') {
        const d = await reportsAPI.gstWorksheet(startDate, endDate);
        setGstData(d);
      } else if (activeTab === 't2125') {
        const d = await reportsAPI.t2125(year);
        setT2125Data(d);
      }
    } catch {
      setError('Could not load report data. Please ensure the backend is running and try again.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, startDate, endDate, year, asOfDate, selectedAccountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Determine which control mode to show
  const usesDateRange = activeTab === 'pl' || activeTab === 'expenses' || activeTab === 'general_ledger' || activeTab === 'gst';
  const usesYearOnly = activeTab === 'monthly' || activeTab === 'tax' || activeTab === 't2125';
  const usesSingleDate = activeTab === 'balance_sheet' || activeTab === 'trial_balance';
  const usesNoControls = activeTab === 'ar_aging';

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

        {/* Date / Year / Single Date Controls */}
        {!usesNoControls && (
          <div className="flex flex-wrap items-end gap-4 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            {usesDateRange && (
              <>
                {/* Account selector for General Ledger */}
                {activeTab === 'general_ledger' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Account
                    </label>
                    <select
                      value={selectedAccountId ?? ''}
                      onChange={(e) => setSelectedAccountId(e.target.value ? Number(e.target.value) : null)}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition bg-white min-w-[220px]"
                    >
                      <option value="">Select an account...</option>
                      {accounts.map((acct: any) => (
                        <option key={acct.id} value={acct.id}>
                          {acct.code ? `${acct.code} - ` : ''}{acct.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
            )}
            {usesYearOnly && (
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
            {usesSingleDate && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  As of Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="date"
                    value={asOfDate}
                    onChange={(e) => setAsOfDate(e.target.value)}
                    className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                </div>
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
        )}

        {/* AR Aging gets a simpler control bar with just Refresh */}
        {usesNoControls && (
          <div className="flex items-end gap-4 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-sm text-slate-500">This report shows current outstanding receivables. No date parameters needed.</p>
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition ml-auto"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        )}

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
            {activeTab === 'balance_sheet' && <BalanceSheetTab data={balanceSheetData} />}
            {activeTab === 'trial_balance' && <TrialBalanceTab data={trialBalanceData} />}
            {activeTab === 'general_ledger' && <GeneralLedgerTab data={generalLedgerData} />}
            {activeTab === 'ar_aging' && <ARAgingTab data={arAgingData} />}
            {activeTab === 'gst' && <GSTWorksheetTab data={gstData} />}
            {activeTab === 't2125' && <T2125Tab data={t2125Data} />}
          </>
        )}
      </div>
    </div>
  );
}
