'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Transaction } from '@/lib/types';
import { formatCurrency, formatPrice, getTransactionFee } from '@/lib/calculations';

interface Props {
  transactions: Transaction[];
  quarters: { label: string; endDate: string }[];
  snapshotDate: string | null;
  onSnapshotChange: (date: string | null) => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onAddTransaction: () => void;
}

export default function TransactionHistory({ 
  transactions, 
  quarters,
  snapshotDate, 
  onSnapshotChange, 
  onEdit, 
  onDelete, 
  onAddTransaction 
}: Props) {
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate current quarter label
  const now = new Date();
  const currentQ = Math.ceil((now.getMonth() + 1) / 3);
  const currentYear = now.getFullYear();
  const currentQLabel = `Q${currentQ} ${currentYear}`;

  const filteredTransactions = useMemo(() => {
    let start: string;
    let end: string;

    if (!snapshotDate) {
      // Live mode -> Show ONLY current quarter transactions
      const startDate = new Date(now.getFullYear(), (currentQ - 1) * 3, 1);
      start = startDate.toISOString().split('T')[0];
      end = '9999-12-31';
    } else {
      // Snapshot mode -> Show ONLY selected quarter transactions
      const selectedQ = quarters.find(q => q.endDate === snapshotDate);
      if (!selectedQ) return transactions.filter(tx => tx.date <= snapshotDate);
      
      const endDate = new Date(selectedQ.endDate);
      const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 2, 1);
      start = startDate.toISOString().split('T')[0];
      end = selectedQ.endDate;
    }

    return transactions.filter(tx => tx.date >= start && tx.date <= end);
  }, [transactions, snapshotDate, quarters, currentQ]);

  const sorted = [...filteredTransactions].sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    if (timeA !== timeB) return sortDir === 'asc' ? timeA - timeB : timeB - timeA;
    return a.ticker.localeCompare(b.ticker);
  });

  const handleFilterChange = (date: string | null) => {
    onSnapshotChange(date);
    setIsFilterOpen(false);
  };

  function handleDelete(id: string) {
    if (confirmId === id) {
      onDelete(id);
      setConfirmId(null);
    } else {
      setConfirmId(id);
      setTimeout(() => setConfirmId(prev => prev === id ? null : prev), 3000);
    }
  }

  const currentFilterLabel = snapshotDate 
    ? quarters.find(q => q.endDate === snapshotDate)?.label || 'SNAPSHOT'
    : currentQLabel;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: 'var(--space-md)' }}>
      <div className="card-header" style={{ flexWrap: 'wrap', gap: '8px', marginBottom: 'var(--space-sm)' }}>
        <span className="card-title">
          <span className="card-title-accent">■</span> Transaction History
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1 }}>
          
          <div className="custom-dropdown" ref={filterRef}>
            <button 
              className={`dropdown-trigger ${snapshotDate ? 'is-snapshot' : ''}`}
              style={{ width: '130px', height: '24px', padding: '2px 8px' }}
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {!snapshotDate && <span className="status-dot" />}
                <span style={{ fontSize: '0.65rem' }}>{currentFilterLabel}</span>
              </div>
              <span style={{ fontSize: '0.5rem', opacity: 0.5 }}>{isFilterOpen ? '▲' : '▼'}</span>
            </button>

            {isFilterOpen && (
              <div className="dropdown-menu" style={{ right: 0, top: 'calc(100% + 4px)', width: '140px' }}>
                <div className={`dropdown-item ${!snapshotDate ? 'active' : ''}`} onClick={() => handleFilterChange(null)}>
                  <span className="status-dot" style={{ marginRight: '8px' }} /> {currentQLabel}
                </div>
                {[...quarters].reverse().map(q => (
                  <div key={q.endDate} className={`dropdown-item ${snapshotDate === q.endDate ? 'active' : ''}`} onClick={() => handleFilterChange(q.endDate)}>
                    ◷ {q.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {filteredTransactions.length} records
          </span>
          <button className="btn btn-primary btn-sm" onClick={onAddTransaction} id="add-transaction-btn">
            + NEW TXN
          </button>
        </div>
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="empty-state" style={{ flex: 1 }}>
          <div className="empty-state-text">NO TRANSACTIONS RECORDED</div>
          <button className="btn btn-primary" onClick={onAddTransaction}>+ Add Transaction</button>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <table className="data-table" id="transactions-table">
            <thead>
              <tr>
                <th onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} style={{ cursor: 'pointer' }}>
                  Date {sortDir === 'asc' ? '▲' : '▼'}
                </th>
                <th>Type</th>
                <th>Ticker</th>
                <th className="td-right">Qty</th>
                <th className="td-right">Price</th>
                <th className="td-right">Total</th>
                <th className="td-right">Fee</th>
                <th>Notes</th>
                <th className="td-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(tx => (
                <tr key={tx.id}>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {(() => {
                      const [y, m, d] = tx.date.split('-');
                      return `${d}/${m}/${y}`;
                    })()}
                  </td>
                  <td>
                    <span className={`tag ${tx.type === 'BUY' ? 'tag-buy' : 'tag-sell'}`}>
                      {tx.type}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700 }}>{tx.ticker}</td>
                  <td className="td-right">{tx.quantity.toFixed(6)}</td>
                  <td className="td-right">{formatPrice(tx.price)}</td>
                  <td className="td-right" style={{ fontWeight: 600 }}>
                    {formatCurrency(tx.quantity * tx.price + getTransactionFee(tx.commission))}
                  </td>
                  <td className="td-right" style={{ color: 'var(--text-muted)' }}>
                    {tx.commission ? formatCurrency(getTransactionFee(tx.commission)) : '—'}
                  </td>
                  <td style={{ color: 'var(--text-muted)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tx.notes || '—'}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn btn-secondary btn-sm" onClick={() => onEdit(tx)} title="Edit">
                        ✎
                      </button>
                      <button
                        className={`btn btn-sm ${confirmId === tx.id ? 'btn-danger-confirm' : 'btn-danger'}`}
                        onClick={() => handleDelete(tx.id)}
                        title={confirmId === tx.id ? 'Click again to confirm' : 'Delete'}
                      >
                        {confirmId === tx.id ? 'CONFIRM?' : '✕'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
