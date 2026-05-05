'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Position } from '@/lib/types';
import { formatNumber } from '@/lib/calculations';

interface Props {
  positions: Position[];
}

/**
 * Modern Digital Palette (Inspired by High-End Dashboards)
 * Clean, vibrant, and professional.
 */
const MODERN_PALETTE = [
  '#3b82f6', // 1. Digital Blue (Google/Apple style)
  '#fb923c', // 2. Bright Orange
  '#10b981', // 3. Emerald Green
  '#a855f7', // 4. Modern Purple
  '#06b6d4', // 5. Cyan
  '#f59e0b', // 6. Amber
  '#6366f1', // 7. Indigo
  '#14b8a6', // 8. Teal
  '#ec4899', // 9. Rose (Wait, no pink? I'll use #f43f5e which is more Red-ish)
  '#f43f5e', // 9. Rose Red
  '#84cc16', // 10. Lime
  '#0ea5e9', // 11. Sky Blue
  '#64748b', // 12. Slate
];

const getSliceColor = (index: number) => {
  return MODERN_PALETTE[index % MODERN_PALETTE.length];
};

const RADIAN = Math.PI / 180;

/**
 * Helper to get a likely logo URL for a ticker
 */
const getLogoUrl = (ticker: string) => {
  // Try to guess domain from ticker
  const domain = `${ticker.toLowerCase()}.com`;
  return `https://logo.clearbit.com/${domain}`;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const renderCustomLabel = ({
  cx, cy, midAngle, outerRadius, ticker, weight,
}: any) => {
  const radius = outerRadius + 25;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const anchor = x > cx ? 'start' : 'end';

  // Offset for icon
  const iconSize = 20;
  const iconX = x + (anchor === 'start' ? 0 : -iconSize - 35);
  const textX = x + (anchor === 'start' ? iconSize + 8 : -30);

  return (
    <g>
      {/* Icon Placeholder / Image */}
      <defs>
        <clipPath id={`clip-${ticker}`}>
          <circle cx={iconX + iconSize / 2} cy={y} r={iconSize / 2} />
        </clipPath>
      </defs>
      <image
        x={iconX}
        y={y - iconSize / 2}
        width={iconSize}
        height={iconSize}
        xlinkHref={getLogoUrl(ticker)}
        clipPath={`url(#clip-${ticker})`}
        onError={(e: any) => { e.target.style.display = 'none'; }}
      />

      <text
        x={textX}
        y={y}
        textAnchor={anchor}
        dominantBaseline="central"
        style={{ fontFamily: 'var(--font-mono)', pointerEvents: 'none' }}
      >
        <tspan
          x={textX}
          dy="-0.5em"
          style={{ fontSize: '0.95rem', fontWeight: 800, fill: '#ffffff' }}
        >
          {ticker}
        </tspan>
        <tspan
          x={textX}
          dy="1.5em"
          style={{ fontSize: '0.85rem', fontWeight: 600, fill: '#94a3b8' }}
        >
          {formatNumber(weight, 1)}%
        </tspan>
      </text>
    </g>
  );
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function AllocationPieChart({ positions }: Props) {
  const chartData = useMemo(() => {
    const sorted = positions.map(p => ({
      name: p.name || p.ticker,
      ticker: p.ticker,
      value: p.currentValue,
      weight: p.weight,
      sector: p.sector || 'Other'
    })).sort((a, b) => b.value - a.value);

    return sorted.map((item, index) => ({
      ...item,
      color: getSliceColor(index)
    }));
  }, [positions]);

  if (positions.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="card-title-accent">■</span> Allocation
          </span>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">🥧</div>
          <div className="empty-state-text">No positions to display</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">
          <span className="card-title-accent">■</span> Portfolio Allocation
        </span>
      </div>

      <div style={{ width: '100%', height: '290px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={95}
              paddingAngle={3}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              stroke="none"
              label={renderCustomLabel}
              labelLine={false}
              isAnimationActive={true}
            >
              {chartData.map((entry: any, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="chart-tooltip" style={{
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                  }}>
                    <div style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: 800 }}>
                      {d.name}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase' }}>
                      {d.sector}
                    </div>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
