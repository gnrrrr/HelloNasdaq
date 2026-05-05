'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Transaction, SearchResult } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Transaction) => void;
  editTransaction?: Transaction | null;
}

export default function TransactionModal({ isOpen, onClose, onSave, editTransaction }: Props) {
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY');
  const [ticker, setTicker] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [dd, setDd] = useState('00');
  const [mm, setMm] = useState('00');
  const [yy, setYy] = useState('0000');
  const ddRef = useRef<HTMLInputElement>(null);
  const mmRef = useRef<HTMLInputElement>(null);
  const yyRef = useRef<HTMLInputElement>(null);
  const [commission, setCommission] = useState('');
  const [notes, setNotes] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      if (editTransaction) {
        setType(editTransaction.type);
        setTicker(editTransaction.ticker);
        setQuantity(String(editTransaction.quantity));
        setPrice(String(editTransaction.price));
        const [y, m, d] = editTransaction.date.split('-');
        setDd(d); setMm(m); setYy(y);
        setCommission(editTransaction.commission ? String(editTransaction.commission) : '');
        setNotes(editTransaction.notes || '');
      } else {
        setType('BUY');
        setTicker('');
        setQuantity('');
        setPrice('');
        const now = new Date();
        setDd(String(now.getDate()).padStart(2, '0'));
        setMm(String(now.getMonth() + 1).padStart(2, '0'));
        setYy(String(now.getFullYear()));
        setCommission('');
        setNotes('');
      }
      setSearchResults([]);
      setShowSearch(false);
    }
  }, [isOpen, editTransaction]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const searchTicker = useCallback(async (query: string) => {
    if (query.length < 1) {
      setSearchResults([]);
      setShowSearch(false);
      return;
    }

    setSearchLoading(true);
    try {
      const res = await fetch(`/api/stock/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data);
      setShowSearch(data.length > 0);
    } catch {
      setSearchResults([]);
    }
    setSearchLoading(false);
  }, []);

  function handleTickerChange(value: string) {
    setTicker(value.toUpperCase());
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchTicker(value), 300);
  }

  function selectTicker(result: SearchResult) {
    setTicker(result.symbol);
    setShowSearch(false);
    setSearchResults([]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate required fields
    if (!ticker || !quantity || !price || dd === '00' || mm === '00' || yy === '0000') {
      setError('PLEASE COMPLETE ALL REQUIRED FIELDS');
      return;
    }

    // Validate numeric values
    if (parseFloat(quantity) <= 0 || parseFloat(price) < 0) {
      setError('INVALID QUANTITY OR PRICE');
      return;
    }

    // Semantic Validation
    const dNum = parseInt(dd);
    const mNum = parseInt(mm);
    const yNum = parseInt(yy);

    const maxDays = new Date(yNum, mNum, 0).getDate();
    if (mNum < 1 || mNum > 12 || dNum < 1 || dNum > maxDays || yNum < 1900 || yNum > 2100) {
      setError('INVALID DATE FORMAT');
      return;
    }

    // Prevent future dates
    const selectedDateStr = `${yy}-${mm}-${dd}`;
    const selectedDate = new Date(selectedDateStr);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (selectedDate > today) {
      setError('FUTURE DATES ARE NOT ALLOWED');
      return;
    }

    const transaction: Transaction = {
      id: editTransaction?.id || uuidv4(),
      ticker: ticker.toUpperCase(),
      type,
      quantity: parseFloat(quantity),
      price: parseFloat(price),
      date: selectedDateStr,
      commission: commission ? parseFloat(commission) : undefined,
      notes: notes || undefined,
    };

    onSave(transaction);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" id="transaction-modal">
        <div className="modal-header">
          <span className="modal-title">
            {editTransaction ? 'Edit Transaction' : 'New Transaction'}
          </span>
          <button className="btn-ghost" onClick={onClose} style={{ fontSize: '1.2rem' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body">
            {error && (
              <div style={{ 
                background: 'rgba(255, 107, 0, 0.1)',
                borderLeft: '2px solid var(--accent-primary)',
                padding: '10px 12px',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ 
                  color: 'var(--accent-primary)', 
                  fontSize: '1rem',
                  fontWeight: 900
                }}>!</span>
                <span style={{ 
                  color: 'var(--accent-primary)', 
                  fontSize: '0.65rem', 
                  fontWeight: 700, 
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '1px',
                  textTransform: 'uppercase'
                }}>
                  {error}
                </span>
              </div>
            )}
            {/* Buy/Sell Toggle */}
            <div className="form-group">
              <label className="form-label">Type</label>
              <div className="toggle-group">
                <button
                  type="button"
                  className={`toggle-btn ${type === 'BUY' ? 'active-buy' : ''}`}
                  onClick={() => setType('BUY')}
                >
                  BUY
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${type === 'SELL' ? 'active-sell' : ''}`}
                  onClick={() => setType('SELL')}
                >
                  SELL
                </button>
              </div>
            </div>

            {/* Ticker Search */}
            <div className="form-group" ref={searchRef} style={{ position: 'relative' }}>
              <label className="form-label">Ticker Symbol</label>
              <input
                type="text"
                className="form-input"
                value={ticker}
                onChange={(e) => handleTickerChange(e.target.value)}
                placeholder="SYMBOL"
                required
                id="ticker-input"
                autoComplete="off"
              />
              {searchLoading && (
                <div style={{ position: 'absolute', right: 12, top: 28, color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                  ...
                </div>
              )}
              {showSearch && searchResults.length > 0 && (
                <div className="search-dropdown">
                  {searchResults.map(r => (
                    <div key={r.symbol} className="search-item" onClick={() => selectTicker(r)}>
                      <span className="search-item-symbol">{r.symbol}</span>
                      <span className="search-item-name">{r.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quantity & Price */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input
                  type="number"
                  className="form-input"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  required
                  min="0.0001"
                  step="any"
                  id="quantity-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Price (USD)</label>
                <input
                  type="number"
                  className="form-input"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  required
                  min="0"
                  step="any"
                  id="price-input"
                />
              </div>
            </div>

            {/* Date */}
            <div className="form-group">
              <label className="form-label">Date (DD / MM / YYYY)</label>
              <div 
                className="form-input" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '2px', 
                  cursor: 'text',
                  padding: '8px 12px'
                }}
              >
                <input
                  ref={ddRef}
                  type="text"
                  inputMode="numeric"
                  value={dd}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    if (raw.length === 0) { setDd('00'); return; }
                    const val = raw.slice(-2);
                    setDd(val.padStart(2, '0'));
                    if (raw.length >= 2) mmRef.current?.focus();
                  }}
                  onClick={(e) => { e.stopPropagation(); (e.target as HTMLInputElement).select(); }}
                  style={{ width: '20px', background: 'transparent', border: 'none', outline: 'none', color: 'inherit', textAlign: 'center', padding: 0, fontFamily: 'inherit', fontSize: 'inherit' }}
                />
                <span style={{ opacity: 0.35, userSelect: 'none', fontSize: '0.8rem' }}>/</span>
                <input
                  ref={mmRef}
                  type="text"
                  inputMode="numeric"
                  value={mm}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    if (raw.length === 0) { setMm('00'); return; }
                    const val = raw.slice(-2);
                    setMm(val.padStart(2, '0'));
                    if (raw.length >= 2) yyRef.current?.focus();
                  }}
                  onClick={(e) => { e.stopPropagation(); (e.target as HTMLInputElement).select(); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && (mm === '00' || !mm)) ddRef.current?.focus();
                  }}
                  style={{ width: '20px', background: 'transparent', border: 'none', outline: 'none', color: 'inherit', textAlign: 'center', padding: 0, fontFamily: 'inherit', fontSize: 'inherit' }}
                />
                <span style={{ opacity: 0.35, userSelect: 'none', fontSize: '0.8rem' }}>/</span>
                <input
                  ref={yyRef}
                  type="text"
                  inputMode="numeric"
                  value={yy}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    if (raw.length === 0) { setYy('0000'); return; }
                    const val = raw.slice(-4);
                    setYy(val.padStart(4, '0'));
                  }}
                  onClick={(e) => { e.stopPropagation(); (e.target as HTMLInputElement).select(); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && (yy === '0000' || !yy)) mmRef.current?.focus();
                  }}
                  style={{ width: '40px', background: 'transparent', border: 'none', outline: 'none', color: 'inherit', textAlign: 'center', padding: 0, fontFamily: 'inherit', fontSize: 'inherit' }}
                />
              </div>
            </div>

            {/* Commission & Notes */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Commission (Optional)</label>
                <input
                  type="number"
                  className="form-input"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="any"
                  id="commission-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Notes (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional note..."
                  id="notes-input"
                />
              </div>
            </div>

            {/* Total Preview */}
            {quantity && price && (
              <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-sm)',
                padding: 'var(--space-md)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 'var(--space-sm)',
              }}>
                <span style={{ color: 'var(--text-muted)' }}>TOTAL</span>
                <span style={{ color: 'var(--text-bright)', fontWeight: 700 }}>
                  ${(parseFloat(quantity) * parseFloat(price) + (commission ? parseFloat(commission) : 0)).toFixed(4)}
                </span>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" id="save-transaction-btn">
              {editTransaction ? 'Update' : 'Add'} Transaction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
