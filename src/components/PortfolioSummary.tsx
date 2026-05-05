'use client';

import { formatCurrency } from '@/lib/calculations';

interface Props {
  totalValue: number;
  totalCost: number;
  totalReturn: number;
  totalReturnPct: number;
  portfolioReturn: number | null;
  benchmarkReturn: number | null;
}

export default function PortfolioSummary({
  totalValue,
  totalCost,
  totalReturn,
  totalReturnPct,
  portfolioReturn,
}: Props) {
  return (
    <div className="metrics-grid four-cols">
      <div className="metric-card">
        <div className="metric-label">Portfolio Value</div>
        <div className="metric-value">{formatCurrency(totalValue)}</div>
      </div>

      <div className="metric-card">
        <div className="metric-label">Total Invested</div>
        <div className="metric-value">{formatCurrency(totalCost)}</div>
      </div>

      <div className="metric-card">
        <div className="metric-label">Total Return</div>
        <div className={`metric-value ${totalReturn >= 0 ? 'positive' : 'negative'}`}>
          {totalReturn >= 0 ? '+' : '-'}{formatCurrency(Math.abs(totalReturn))}
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Total Return (%)
        </div>
        <div className={`metric-value ${(portfolioReturn ?? 0) >= 0 ? 'positive' : 'negative'}`}>
          {portfolioReturn != null ? `${portfolioReturn >= 0 ? '+' : ''}${portfolioReturn.toFixed(2)}%` : '—'}
        </div>
      </div>
    </div>
  );
}
