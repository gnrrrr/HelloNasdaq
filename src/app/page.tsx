'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import PortfolioSummary from '@/components/PortfolioSummary';
import PositionsTable from '@/components/PositionsTable';
import TransactionModal from '@/components/TransactionModal';
import TransactionHistory from '@/components/TransactionHistory';
import PerformanceChart from '@/components/PerformanceChart';
import AllocationPieChart from '@/components/AllocationPieChart';
import { Transaction, Position, StockQuote, CashFlow, StockSplit } from '@/lib/types';
import {
  addTransaction,
  updateTransaction,
  deleteTransaction,
  loadSharedData as loadData,
} from '@/lib/storage';
import {
  calculatePositions,
  calculatePortfolioTotals,
  buildCashFlows,
  calculateMWR,
  calculateSimpleROIHistory,
  generatePortfolioHistory,
  getTransactionFee,
  getTodayStr,
} from '@/lib/calculations';
import { buildQuarterList, Quarter } from '@/lib/quarters';

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [positions, setPositions] = useState<Position[]>([]);
  const [splits, setSplits] = useState<StockSplit[]>([]);

  const [perfData, setPerfData] = useState<{ date: string; portfolio: number; benchmark: number }[]>([]);
  const [summaryReturn, setSummaryReturn] = useState<number | null>(null);
  const [summaryBenchReturn, setSummaryBenchReturn] = useState<number | null>(null);
  const [chartReturn, setChartReturn] = useState<number | null>(null);
  const [chartBenchReturn, setChartBenchReturn] = useState<number | null>(null);

  



  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [marketDate, setMarketDate] = useState<string>(getTodayStr());

  // ── Snapshot / Time Machine ──────────────────────────────────
  const [snapshotDate, setSnapshotDate] = useState<string | null>(null);

  /** Quarters derived from the earliest transaction */
  const quarters: Quarter[] = useMemo(() => {
    if (transactions.length === 0) return [];
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    return buildQuarterList(sorted[0].date);
  }, [transactions]);

  // Auto-jump logic: If the current snapshot is no longer valid (e.g. transactions deleted), reset to Live
  useEffect(() => {
    if (snapshotDate && !quarters.some(q => q.endDate === snapshotDate)) {
      setSnapshotDate(null);
    }
  }, [snapshotDate, quarters]);

  /**
   * Transactions filtered to the snapshot boundary.
   * In LIVE mode this is the full list.
   */
  const activeTxs: Transaction[] = useMemo(() => {
    // In LIVE mode, we show all transactions up to current wall-clock today.
    // We only filter if we are in a historical snapshot mode.
    if (snapshotDate) {
      return transactions.filter(tx => tx.date <= snapshotDate);
    }
    const now = new Date();
    const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    return transactions.filter(tx => tx.date <= today);
  }, [transactions, snapshotDate]);

  // Load transactions from shared database
  useEffect(() => {
    async function init() {
      const txs = await loadData();
      setTransactions(txs);
    }
    init();
  }, []);

  // Fetch stock quotes when transactions change (include QQQ for benchmark)
  const fetchQuotes = useCallback(async (txs: Transaction[]) => {
    const tickers = [...new Set(txs.map(t => t.ticker))];
    if (tickers.length === 0) {
      setLoading(false);
      return;
    }

    try {
      // Always include QQQ for benchmark valuation
      const allSymbols = [...new Set([...tickers, '^NDX'])];
      const res = await fetch(`/api/stock/quote?symbols=${allSymbols.join(',')}`);
      const data: Record<string, StockQuote> = await res.json();

      setQuotes(data);
    } catch {
      // Silently handle quote fetch failures
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (transactions.length > 0) {
      fetchQuotes(transactions);
    } else {
      setLoading(false);
    }
  }, [transactions, fetchQuotes]);




  // Calculate positions when quotes or snapshot change.
  useEffect(() => {
    if (Object.keys(quotes).length > 0 && !snapshotDate) {
      const pos = calculatePositions(activeTxs, quotes, splits);
      setPositions(pos);
    }
  }, [activeTxs, quotes, snapshotDate, splits]);

  // Fetch historical data for charts
  useEffect(() => {
    async function fetchHistory() {
      if (transactions.length === 0 || Object.keys(quotes).length === 0) return;

      const tickers = [...new Set(transactions.map(t => t.ticker))];

      const earliestTxDate = [...transactions].sort((a, b) => a.date.localeCompare(b.date))[0]?.date;
      // For accurate EMA200, we need a long warm-up period.
      // We always fetch at least 2Y to ensure convergence.
      let period = '2Y';
      if (earliestTxDate) {
        const yearsDiff = (new Date().getTime() - new Date(earliestTxDate).getTime()) / (1000 * 60 * 60 * 24 * 365);
        if (yearsDiff > 5) period = '5Y';
        else if (yearsDiff > 2) period = '5Y';
        else period = '2Y';
      } else {
        period = '2Y';
      }

      try {
        // Fetch historical prices for all tickers and NDX
        const promises = [...tickers, '^NDX'].map(async (symbol) => {
          const res = await fetch(`/api/stock/history?symbol=${symbol}&period=${period}`);
          const data = await res.json();
          return { symbol, prices: data.prices || [], splits: data.splits || [] };
        });

        const results = await Promise.all(promises);
        const historicalPrices: Record<string, { date: string; close: number; open?: number }[]> = {};
        const allSplits: StockSplit[] = [];

        for (const r of results) {
          historicalPrices[r.symbol] = r.prices;
          if (r.splits) {
            allSplits.push(...r.splits);
          }
        }
        
        // Update splits state so calculations can use it
        setSplits(allSplits);

        // ── Determine Effective Market Date ──
        const qqq = historicalPrices['^NDX'] || [];
        const effectiveMarketDate = (qqq.length > 0 && !snapshotDate)
          ? qqq[qqq.length - 1].date
          : (snapshotDate || getTodayStr());

        // Transactions filtered to the relevant boundary
        const now = new Date();
        const calendarToday = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        const transactionLimit = snapshotDate || calendarToday;
        const filteredTxs = transactions.filter(tx => tx.date <= transactionLimit);

        const normalPositions = calculatePositions(filteredTxs, quotes, splits, effectiveMarketDate);
        setPositions(normalPositions);

        if (!snapshotDate) {
          setMarketDate(effectiveMarketDate);
        }

        // Generate portfolio value history
        const tickerPrices = { ...historicalPrices };
        delete tickerPrices['^NDX'];



        const history = generatePortfolioHistory(filteredTxs, tickerPrices, splits);

        // ── Snapshot Mode: compute positions from historical prices ──
        if (snapshotDate) {
          // Find the closest trading day at or before snapshotDate
          const snapshotHistory = history.filter(h => h.date <= snapshotDate);
          if (snapshotHistory.length > 0) {
            const snapPoint = snapshotHistory[snapshotHistory.length - 1];

            // Build a synthetic quotes record using historical close prices
            const snapQuotes: Record<string, StockQuote> = {};
            for (const ticker of Object.keys(tickerPrices)) {
              const priceArr = tickerPrices[ticker];
              // Find the price on or before snapshotDate
              const snapPrice = [...priceArr]
                .reverse()
                .find(p => p.date <= snapPoint.date);
              if (snapPrice) {
                // Find prior day for previousClose (for day-change calc)
                const snapIdx = priceArr.findIndex(p => p.date === snapPrice.date);
                const prevClose = snapIdx > 0 ? priceArr[snapIdx - 1].close : snapPrice.close;
                snapQuotes[ticker] = {
                  symbol: ticker,
                  name: quotes[ticker]?.name || ticker,
                  price: snapPrice.close,
                  change: snapPrice.close - prevClose,
                  changePct: prevClose > 0 ? ((snapPrice.close - prevClose) / prevClose) * 100 : 0,
                  previousClose: prevClose,
                };
              }
            }
            const snapPositions = calculatePositions(filteredTxs, snapQuotes, splits, snapshotDate);
            setPositions(snapPositions);
          }
        }

        // Generate performance comparison data (return on cost %)
        const qqqlookup: Record<string, number> = {};
        qqq.forEach(p => { qqqlookup[p.date] = p.close; });

        // Clip history to market boundary
        const displayHistory = history.filter(h => h.date <= effectiveMarketDate);

        // Inject today's live QQQ price from real-time quotes
        const liveQQQ = quotes['^NDX']?.price;
        if (liveQQQ && liveQQQ > 0) {
          qqqlookup[effectiveMarketDate] = liveQQQ;
          // Ensure QQQ array also has marketDate entry for the simulation
          if (!qqq.find(p => p.date === effectiveMarketDate)) {
            qqq.push({ date: effectiveMarketDate, close: liveQQQ });
          } else {
            // Update today's close with live price
            const todayEntry = qqq.find(p => p.date === effectiveMarketDate);
            if (todayEntry) todayEntry.close = liveQQQ;
          }
        }

        // In snapshot mode skip the live injection — history is already clipped
        if (!snapshotDate) {
          // Inject today's live portfolio prices into history
          if (displayHistory.length > 0) {
            const lastHistory = displayHistory[displayHistory.length - 1];
            let liveValue = 0;
            let liveCost = 0;
            const posMap = new Map<string, { shares: number; cost: number }>();

            for (const tx of filteredTxs) {
              const h = posMap.get(tx.ticker) || { shares: 0, cost: 0 };
              if (tx.type === 'BUY') {
                h.shares += tx.quantity;
                h.cost += tx.quantity * tx.price + getTransactionFee(tx.commission);
              } else {
                if (h.shares > 0) {
                  const costPerShare = h.cost / h.shares;
                  h.shares -= tx.quantity;
                  h.cost = h.shares * costPerShare;
                }
              }
              posMap.set(tx.ticker, h);
            }

            posMap.forEach((h, ticker) => {
              if (h.shares > 0 && quotes[ticker]?.price) {
                liveValue += h.shares * quotes[ticker].price;
              }
              liveCost += h.cost;
            });

            if (liveValue > 0) {
              if (lastHistory.date === effectiveMarketDate) {
                lastHistory.value = liveValue;
                lastHistory.cost = liveCost;
              } else {
                displayHistory.push({ date: effectiveMarketDate, value: liveValue, cost: liveCost });
              }
            }
          }
        }

        if (displayHistory.length > 0 && qqq.length > 0) {
          // ── Professional Hybrid: TWR Chart (%) + Simple ROI Cards ──
          const portHistory = generatePortfolioHistory(filteredTxs, tickerPrices, splits);
          const portHistoryClipped = portHistory.filter(h => h.date <= effectiveMarketDate);

          // Build benchmark history for TWR comparison
          const benchHistory: { date: string; value: number; cost: number }[] = [];
          let simShares = 0, simCost = 0, txIdx = 0;
          for (const h of portHistoryClipped) {
            while (txIdx < filteredTxs.length && filteredTxs[txIdx].date <= h.date) {
              const tx = filteredTxs[txIdx];
              const txAmt = tx.quantity * tx.price + getTransactionFee(tx.commission);
              let qp = 0;
              for (let j = 0; j < qqq.length; j++) {
                if (qqq[j].date >= tx.date) {
                  // Prefer today's Open price to account for opening gaps.
                  // Fall back to today's Close if Open is somehow missing, 
                  // or last available price if date doesn't match perfectly.
                  qp = qqq[j].open || qqq[j].close;
                  break;
                }
              }
              if (qp === 0) qp = qqq[qqq.length - 1]?.close || 1;
              if (tx.type === 'BUY') { simShares += txAmt / qp; simCost += txAmt; }
              else { const r = Math.min(txAmt / (simShares * qp), 1); simShares -= simShares * r; simCost -= simCost * r; }
              txIdx++;
            }
            benchHistory.push({ date: h.date, value: simShares * (qqqlookup[h.date] || 0), cost: simCost });
          }

          // Generate Simple ROI for absolute return visualization
          const portROIHistory = calculateSimpleROIHistory(portHistoryClipped);
          const benchROIHistory = calculateSimpleROIHistory(benchHistory);

          const perfPoints = portROIHistory.map((p, i) => ({
            date: p.date,
            portfolio: p.roi,
            benchmark: benchROIHistory[i]?.roi ?? 0
          }));

          setPerfData(perfPoints);

          // Chart Legends use TWR for consistency with the lines
          const lastPoint = perfPoints[perfPoints.length - 1];
          if (lastPoint) {
            setChartReturn(lastPoint.portfolio);
            setChartBenchReturn(lastPoint.benchmark);
          }

          // Summary Cards use Simple ROI (matches Total Return $)
          const lastH = portHistoryClipped[portHistoryClipped.length - 1];
          const lastBH = benchHistory[benchHistory.length - 1];
          if (lastH && lastH.cost > 0) {
            setSummaryReturn(((lastH.value - lastH.cost) / lastH.cost) * 100);
          }
          if (lastBH && lastBH.cost > 0) {
            setSummaryBenchReturn(((lastBH.value - lastBH.cost) / lastBH.cost) * 100);
          }
        }

        // Calculate MWR using filteredTxs
        const currentTodayStr = snapshotDate || effectiveMarketDate;
        const currentPositions = snapshotDate ? positions : calculatePositions(filteredTxs, quotes, splits, currentTodayStr);
        const totals = calculatePortfolioTotals(currentPositions);
        const cashFlows = buildCashFlows(filteredTxs, totals.totalValue, effectiveMarketDate);
        calculateMWR(cashFlows);


        // Calculate benchmark MWR (QQQ with same cash flow timing)
        if (qqq.length > 0) {
          let qqQShares = 0;
          const benchFlows: { date: string; amount: number }[] = [];

          for (const tx of filteredTxs) {
            const txAmount = tx.quantity * tx.price + getTransactionFee(tx.commission);
            let qqqPrice = 0;
            for (let j = 0; j < qqq.length; j++) {
              const p = qqq[j];
              if (p.date >= tx.date) {
                qqqPrice = (p.date === tx.date && j > 0) ? qqq[j - 1].close : p.close;
                break;
              }
            }
            if (qqqPrice === 0) qqqPrice = qqq[qqq.length - 1]?.close || 1;

            if (tx.type === 'BUY') {
              qqQShares += txAmount / qqqPrice;
              benchFlows.push({ date: tx.date, amount: -txAmount });
            } else {
              qqQShares -= txAmount / qqqPrice;
              benchFlows.push({ date: tx.date, amount: txAmount });
            }
          }

          const mwrQQQPrice = snapshotDate
            ? (qqqlookup[snapshotDate] ?? qqq.filter(p => p.date <= snapshotDate).pop()?.close ?? qqq[qqq.length - 1]?.close ?? 0)
            : (quotes['^NDX']?.price || qqq[qqq.length - 1]?.close || 0);
          const benchValue = qqQShares * mwrQQQPrice;
          benchFlows.push({ date: effectiveMarketDate, amount: benchValue });

          calculateMWR(benchFlows);

        }
      } catch {
        // Silently handle history fetch failures
      }
    }

    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, quotes, snapshotDate]);

  async function handleSaveTransaction(tx: Transaction) {
    if (editingTx) {
      setTransactions(await updateTransaction(tx));
    } else {
      setTransactions(await addTransaction(tx));
    }
    setEditingTx(null);
  }

  function handleEditTransaction(tx: Transaction) {
    setEditingTx(tx);
    setIsModalOpen(true);
  }

  async function handleDeleteTransaction(id: string) {
    setTransactions(await deleteTransaction(id));
  }

  function handleOpenModal() {
    setEditingTx(null);
    setIsModalOpen(true);
  }

  const totals = useMemo(() => calculatePortfolioTotals(positions), [positions]);

  if (loading) {
    return (
      <div className="dashboard">
        <Header quarters={[]} snapshotDate={null} onSnapshotChange={() => { }} />
        <div className="loading-container">
          <div className="loading-bar" />
          <div className="loading-bar" />
          <div className="loading-bar" />
          <div className="loading-bar" />
        </div>
        <div style={{
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
          fontSize: '0.8rem',
          letterSpacing: '2px',
        }}>
          LOADING MARKET DATA...
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard" id="dashboard">
      <Header
        quarters={quarters}
        snapshotDate={snapshotDate}
        onSnapshotChange={setSnapshotDate}
      >
        {/* Snapshot indicator in the center of header to prevent layout shift */}
        {snapshotDate && (() => {
          const q = quarters.find(qt => qt.endDate === snapshotDate);
          return (
            <div className="snapshot-banner">
              <span className="snapshot-banner-icon">◷</span>
              HISTORICAL SNAPSHOT: {q?.label ?? snapshotDate}
            </div>
          );
        })()}
      </Header>

      <div className="grid-2col" style={{ flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', minHeight: 0 }}>
          <PortfolioSummary
            totalValue={totals.totalValue}
            totalCost={totals.totalCost}
            totalReturn={totals.totalReturn}
            totalReturnPct={totals.totalReturnPct}
            portfolioReturn={summaryReturn}
            benchmarkReturn={summaryBenchReturn}
          />
          <PerformanceChart
            data={perfData}
            portfolioReturn={chartReturn}
            benchmarkReturn={chartBenchReturn}
          />
          <TransactionHistory
            transactions={transactions}
            quarters={quarters}
            snapshotDate={snapshotDate}
            onSnapshotChange={setSnapshotDate}
            onEdit={handleEditTransaction}
            onDelete={handleDeleteTransaction}
            onAddTransaction={handleOpenModal}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', minHeight: 0 }}>
          <AllocationPieChart positions={positions} />
          <PositionsTable
            positions={positions}
          />
        </div>
      </div>

      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingTx(null); }}
        onSave={handleSaveTransaction}
        editTransaction={editingTx}
      />
    </div>
  );
}
