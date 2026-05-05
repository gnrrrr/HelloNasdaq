'use client';

import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '@/lib/calculations';

interface Props {
  data: { date: string; value: number; cost: number }[];
}

const RANGES = ['1M', '3M', '6M', '1Y', 'ALL'] as const;

export default function PortfolioChart({ data }: Props) {
  const [range, setRange] = useState<string>('ALL');

  const filteredData = useMemo(() => {
    if (range === 'ALL' || data.length === 0) return data;

    const now = new Date();
    const months: Record<string, number> = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12 };
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - (months[range] || 12));
    const cutoffStr = cutoff.toISOString().split('T')[0];

    return data.filter(d => d.date >= cutoffStr);
  }, [data, range]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatYAxis = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  if (data.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="card-title-accent">■</span> Portfolio Value
          </span>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">📈</div>
          <div className="empty-state-text">Add transactions to see your portfolio chart</div>
        </div>
      </div>
    );
  }

  const startVal = filteredData[0]?.value || 0;
  const endVal = filteredData[filteredData.length - 1]?.value || 0;
  const changeAmt = endVal - startVal;
  const changePct = startVal > 0 ? (changeAmt / startVal) * 100 : 0;
  const isPositive = changeAmt >= 0;
  const lineColor = isPositive ? '#00d4aa' : '#ff4757';

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <span className="card-title">
            <span className="card-title-accent">■</span> Portfolio Value
          </span>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            marginTop: 4,
            color: isPositive ? 'var(--accent-green)' : 'var(--accent-red)',
          }}>
            {isPositive ? '▲' : '▼'} {formatCurrency(Math.abs(changeAmt))} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
          </div>
        </div>
        <div className="chart-controls">
          {RANGES.map(r => (
            <button
              key={r}
              className={`chart-range-btn ${range === r ? 'active' : ''}`}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2332" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#5a6578"
              tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }}
              interval="preserveStartEnd"
              minTickGap={60}
            />
            <YAxis
              tickFormatter={formatYAxis}
              stroke="#5a6578"
              tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }}
              width={70}
              domain={['auto', 'auto']}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="chart-tooltip">
                    <div className="chart-tooltip-label">{label}</div>
                    <div className="chart-tooltip-value">
                      {formatCurrency(payload[0].value as number)}
                    </div>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={2}
              fill="url(#portfolioGradient)"
              dot={false}
              activeDot={{ r: 4, fill: lineColor, stroke: '#0a0e17', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
