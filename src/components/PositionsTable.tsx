'use client';

import { useState } from 'react';
import { Position } from '@/lib/types';
import { formatCurrency, formatPercent, formatNumber, formatPrice } from '@/lib/calculations';

interface Props {
  positions: Position[];
}

type SortKey = 'ticker' | 'currentValue' | 'returnAmt' | 'currentPrice';



export default function PositionsTable({ positions }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('currentValue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sorted = [...positions].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  if (positions.length === 0) {
    return (
      <div className="card" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div className="card-header">
          <span className="card-title">
            <span className="card-title-accent">■</span> Positions
          </span>
        </div>
        <div className="empty-state" style={{ flex: 1 }}>
          <div className="empty-state-text">NO ACTIVE POSITIONS</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="card-header">
        <span className="card-title">
          <span className="card-title-accent">■</span> Positions
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          {positions.length} holdings
        </span>
      </div>

      <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0 }}>
        <table className="data-table" id="positions-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('ticker')}>STOCK{sortIndicator('ticker')}</th>
              <th className="td-right" onClick={() => handleSort('currentValue')}>Value / Qty{sortIndicator('currentValue')}</th>
              <th className="td-right" onClick={() => handleSort('returnAmt')}>P/L{sortIndicator('returnAmt')}</th>
              <th className="td-right" onClick={() => handleSort('currentPrice')}>PRICE / AVG{sortIndicator('currentPrice')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(pos => (
              <tr key={pos.ticker}>
                <td>
                  <div className="ticker-cell">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div className="ticker-symbol">{pos.ticker}</div>
                        {pos.hasSplit && (
                          <span className="badge-split" title={`Adjusted for ${pos.splitRatio}:1 split`}>
                            SPLIT
                          </span>
                        )}
                      </div>
                      <div className="ticker-name">{pos.name}</div>
                    </div>
                  </div>
                </td>
                <td className="td-right">
                  <div style={{ fontWeight: 600 }}>{formatCurrency(pos.currentValue)}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    {formatNumber(pos.totalShares, 6)}
                  </div>
                </td>
                <td className={`td-right ${pos.returnAmt >= 0 ? 'td-positive' : 'td-negative'}`}>
                  <div style={{ fontWeight: 600 }}>
                    {pos.returnAmt > 0 ? '+' : ''}{formatCurrency(pos.returnAmt)}
                  </div>
                  <div style={{ fontSize: '0.7rem' }}>
                    {formatPercent(pos.returnPct)}
                  </div>
                </td>
                <td className="td-right">
                  <div style={{ fontWeight: 600 }}>{formatCurrency(pos.currentPrice)}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    {formatPrice(pos.avgCost)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
