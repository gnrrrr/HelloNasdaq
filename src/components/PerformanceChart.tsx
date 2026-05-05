'use client';

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface Props {
  data: { date: string; portfolio: number; benchmark: number }[];
  portfolioReturn: number | null;
  benchmarkReturn: number | null;
}

type TimeRange = '1M' | 'YTD' | '1Y' | '5Y' | 'ALL';

const RANGES: TimeRange[] = ['1M', 'YTD', '1Y', '5Y', 'ALL'];

function getCutoffDate(range: TimeRange): Date | null {
  const now = new Date();
  switch (range) {
    case '1M': { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d; }
    case 'YTD': return new Date(now.getFullYear(), 0, 1);
    case '1Y': { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return d; }
    case '5Y': { const d = new Date(now); d.setFullYear(d.getFullYear() - 5); return d; }
    case 'ALL':
    default: return null;
  }
}

export default function PerformanceChart({ data, portfolioReturn, benchmarkReturn }: Props) {
  const [activeRange, setActiveRange] = useState<TimeRange>('ALL');

  const filteredData = useMemo(() => {
    const cutoff = getCutoffDate(activeRange);
    let filtered = data;
    if (cutoff) {
      const cutoffStr = cutoff.toISOString().split('T')[0];
      filtered = data.filter(d => d.date >= cutoffStr);
    }
    return filtered.map(d => ({
      ...d,
      portfolio: Number((d.portfolio || 0).toFixed(2)),
      benchmark: Number((d.benchmark || 0).toFixed(2)),
    }));
  }, [data, activeRange]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (data.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="card-title-accent">■</span> Performance vs NDX-100
          </span>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-text">Add transactions to see performance comparison</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">
          <span className="card-title-accent">■</span> Performance
          <span style={{ fontSize: '0.77rem', color: 'var(--text-secondary)', marginLeft: 8, fontFamily: 'var(--font-mono)', textTransform: 'none', fontWeight: 700 }}>
            (Simple Return - ROI)
          </span>
        </span>
        <div className="chart-controls">
          {RANGES.map(range => (
            <button
              key={range}
              className={`chart-range-btn${activeRange === range ? ' active' : ''}`}
              onClick={() => setActiveRange(range)}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="perf-legend" style={{ marginBottom: 'var(--space-sm)' }}>
        <div className="perf-legend-item">
          <div className="perf-legend-line" style={{ background: '#ff8800' }} />
          <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
            Portfolio {portfolioReturn != null ? `(${portfolioReturn >= 0 ? '+' : ''}${portfolioReturn.toFixed(2)}%)` : ''}
          </span>
        </div>
        <div className="perf-legend-item">
          <div className="perf-legend-line" style={{ background: '#44aacc' }} />
          <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
            NDX-100 {benchmarkReturn != null ? `(${benchmarkReturn >= 0 ? '+' : ''}${benchmarkReturn.toFixed(2)}%)` : ''}
          </span>
        </div>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filteredData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#5a6578"
              tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', dy: 10 }}
              interval="preserveStartEnd"
              minTickGap={60}
            />
            <YAxis
              tickFormatter={(v) => `${v.toFixed(0)}%`}
              stroke="#5a6578"
              tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }}
              width={60}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="chart-tooltip">
                    <div className="chart-tooltip-label">{label}</div>
                    {payload.map((p, i) => (
                      <div key={i} style={{ color: p.color, fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600 }}>
                        {p.name}: {p.value >= 0 ? '+' : ''}{(p.value as number).toFixed(2)}%
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Legend content={() => null} />
            <Legend content={() => null} />
            <Line type="monotone" dataKey="portfolio" name="Portfolio" stroke="#ff8800" strokeWidth={2} dot={false} activeDot={{ r: 3, fill: '#ff8800', stroke: '#000', strokeWidth: 1 }} />
            <Line type="monotone" dataKey="benchmark" name="NDX-100" stroke="#44aacc" strokeWidth={2} dot={false} strokeDasharray="4 4" activeDot={{ r: 3, fill: '#44aacc', stroke: '#000', strokeWidth: 1 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
