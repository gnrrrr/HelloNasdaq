import { Transaction, Position, CashFlow, StockQuote } from './types';

/**
 * Returns transaction fee.
 * The provided commission is already VAT-inclusive.
 */
export function getTransactionFee(baseCommission?: number): number {
  if (!baseCommission) return 0;
  return baseCommission;
}

// ── Positions Calculation ─────────────────────────────────────

export function getTodayStr(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  const local = new Date(now.getTime() - offset);
  const day = local.getUTCDay(); // 0=Sun, 6=Sat

  if (day === 0) { // Sunday -> Friday
    local.setUTCDate(local.getUTCDate() - 2);
  } else if (day === 6) { // Saturday -> Friday
    local.setUTCDate(local.getUTCDate() - 1);
  }

  return local.toISOString().split('T')[0];
}

export function calculatePositions(
  transactions: Transaction[],
  quotes: Record<string, StockQuote>,
  todayStrOverride?: string
): Position[] {
  const posMap = new Map<string, {
    totalShares: number;
    totalCost: number;
    yesterdayShares: number;
    netAddedToday: number;
  }>();

  const todayStr = todayStrOverride || getTodayStr();

  for (const tx of transactions) {
    const existing = posMap.get(tx.ticker) || {
      totalShares: 0,
      totalCost: 0,
      yesterdayShares: 0,
      netAddedToday: 0
    };

    const isToday = tx.date >= todayStr;

    if (tx.type === 'BUY') {
      existing.totalCost += tx.quantity * tx.price + getTransactionFee(tx.commission);
      existing.totalShares += tx.quantity;
      if (isToday) {
        existing.netAddedToday += tx.quantity * tx.price + getTransactionFee(tx.commission);
      } else {
        existing.yesterdayShares += tx.quantity;
      }
    } else {
      // SELL: reduce shares, reduce cost proportionally
      if (existing.totalShares > 0) {
        const costPerShare = existing.totalCost / existing.totalShares;
        existing.totalShares -= tx.quantity;
        existing.totalCost = existing.totalShares * costPerShare;
      }
      if (isToday) {
        existing.netAddedToday -= (tx.quantity * tx.price - getTransactionFee(tx.commission));
      } else {
        existing.yesterdayShares -= tx.quantity;
      }
    }

    posMap.set(tx.ticker, existing);
  }

  const positions: Position[] = [];
  let totalPortfolioValue = 0;

  // First pass: calculate values
  posMap.forEach((pos, ticker) => {
    // Threshold check for floating point precision (0.00000001)
    if (pos.totalShares < 1e-8) return;
    
    const quote = quotes[ticker];
    const currentPrice = quote?.price || 0;
    const currentValue = pos.totalShares * currentPrice;

    totalPortfolioValue += currentValue;

    // 1. Calculate Yesterday's Value: 
    // We use quote's previousClose. If missing, fall back to currentPrice 
    // to keep dayChange at 0 rather than a huge fake gain/loss.
    const safePreviousClose = (quote?.previousClose && quote.previousClose > 0) 
      ? quote.previousClose 
      : currentPrice;
      
    const yesterdayValue = pos.yesterdayShares * safePreviousClose;
    
    // 2. Calculate Day Change:
    // This is the profit from (held shares * price movement) + (today's bought shares * movement from buy price)
    const dayChange = currentValue - (yesterdayValue + pos.netAddedToday);
    
    // 3. Calculate Day Change %:
    // Base is what the investment was worth at the start of today's relevant period
    const dayChangeBase = (yesterdayValue + pos.netAddedToday);
    const dayChangePct = dayChangeBase > 0 ? (dayChange / dayChangeBase) * 100 : (quote?.changePct || 0);

    // Guard: avgCost is 0 if totalShares rounds to zero (should not happen with threshold above)
    const avgCost = pos.totalShares > 1e-8 ? pos.totalCost / pos.totalShares : 0;
    // Guard: returnPct is 0 if cost is 0 (price was $0 — bad data from API)
    const returnPct = pos.totalCost > 0 ? ((currentValue - pos.totalCost) / pos.totalCost) * 100 : 0;

    positions.push({
      ticker,
      name: quote?.name || ticker,
      totalShares: pos.totalShares,
      avgCost,
      currentPrice,
      currentValue,
      totalCost: pos.totalCost,
      returnAmt: currentValue - pos.totalCost,
      returnPct,
      dayChange,
      dayChangePct,
      netAddedToday: pos.netAddedToday,
      sector: quote?.sector || 'Other',
      weight: 0, // will be set in second pass
    });
  });

  // Second pass: set weights
  for (const pos of positions) {
    pos.weight = totalPortfolioValue > 0
      ? (pos.currentValue / totalPortfolioValue) * 100
      : 0;
  }

  // Sort by current value descending
  positions.sort((a, b) => b.currentValue - a.currentValue);

  return positions;
}

// ── Portfolio Totals ──────────────────────────────────────────

export function calculatePortfolioTotals(positions: Position[]) {
  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const totalCost = positions.reduce((sum, p) => sum + p.totalCost, 0);
  const totalReturn = totalValue - totalCost;
  const totalReturnPct = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;
  
  const dayChange = positions.reduce((sum, p) => sum + p.dayChange, 0);
  const netAddedToday = positions.reduce((sum, p) => sum + (p.netAddedToday || 0), 0);
  
  // The "Starting Point" for today's % change calculation.
  // This is (Portfolio Value Yesterday + Capital Added Today)
  const dayChangeBase = (totalValue - dayChange);
  const dayChangePct = dayChangeBase > 0 ? (dayChange / dayChangeBase) * 100 : 0;

  return { totalValue, totalCost, totalReturn, totalReturnPct, dayChange, dayChangePct, netAddedToday };
}

// ── Cash Flows for MWR ────────────────────────────────────────

export function buildCashFlows(
  transactions: Transaction[],
  currentValue: number,
  endDate: string
): CashFlow[] {
  const flows: CashFlow[] = [];

  for (const tx of transactions) {
    if (tx.type === 'BUY') {
      // Outflow: money invested (negative)
      flows.push({
        date: tx.date,
        amount: -(tx.quantity * tx.price + getTransactionFee(tx.commission)),
      });
    } else {
      // Inflow: money received (positive)
      flows.push({
        date: tx.date,
        amount: tx.quantity * tx.price - getTransactionFee(tx.commission),
      });
    }
  }

  // Final value as positive inflow at end
  if (currentValue > 0) {
    flows.push({
      date: endDate,
      amount: currentValue,
    });
  }

  return flows;
}

// ── MWR / IRR Calculation (Newton-Raphson) ────────────────────

export function calculateMWR(cashFlows: CashFlow[]): number | null {
  if (cashFlows.length < 2) return null;

  // Convert dates to year fractions from first date
  const firstDate = new Date(cashFlows[0].date).getTime();
  const yearMs = 365.25 * 24 * 60 * 60 * 1000;

  const flows = cashFlows.map(cf => ({
    t: (new Date(cf.date).getTime() - firstDate) / yearMs,
    amount: cf.amount,
  }));

  const t_total = flows[flows.length - 1].t;

  // Same-day holding: all transactions and valuation on the same date.
  // Newton-Raphson is undefined for t=0, so compute HPR directly.
  if (t_total <= 0) {
    const nonTerminal = flows.slice(0, -1);
    const netInvested = -nonTerminal.reduce((sum, f) => sum + f.amount, 0);
    if (netInvested <= 0) return null;
    const terminalValue = flows[flows.length - 1].amount;
    return ((terminalValue / netInvested) - 1) * 100;
  }

  // For very short holding periods (< 7 days), Newton-Raphson needs an
  // astronomically high annualized rate which hits the divergence guard.
  // Over such short periods, compounding is negligible so MWR ≡ HPR.
  // Calculate holding period return directly from cash flows.
  if (t_total < 7 / 365.25) {
    const nonTerminal = flows.slice(0, -1);
    const netInvested = -nonTerminal.reduce((sum, f) => sum + f.amount, 0); // positive number
    if (netInvested <= 0) return null;
    const terminalValue = flows[flows.length - 1].amount;
    return ((terminalValue / netInvested) - 1) * 100;
  }

  // Newton-Raphson to find annualized IRR
  let rate = 0.1; // initial guess 10%
  const maxIter = 200;
  const precision = 1e-8;

  for (let i = 0; i < maxIter; i++) {
    let npv = 0;
    let dnpv = 0;

    for (const f of flows) {
      const denom = Math.pow(1 + rate, f.t);
      if (!isFinite(denom) || denom === 0) return null;
      npv += f.amount / denom;
      dnpv -= f.t * f.amount / Math.pow(1 + rate, f.t + 1);
    }

    if (Math.abs(dnpv) < 1e-14) return null; // avoid div by zero

    const newRate = rate - npv / dnpv;

    if (Math.abs(newRate - rate) < precision) {
      rate = newRate;
      break;
    }

    rate = newRate;

    // Guard against divergence
    if (rate < -0.99 || rate > 100 || !isFinite(rate)) return null;
  }

  // Convert annualized IRR to cumulative holding-period return
  // This preserves the MWR cash-flow-weighting methodology while
  // expressing the result as total return over the actual period.
  // Works correctly for any time horizon: 1 week to 10+ years.
  const cumulativeReturn = Math.pow(1 + rate, t_total) - 1;
  return cumulativeReturn * 100;
}



// ── Generate Portfolio Value History ──────────────────────────

export function generatePortfolioHistory(
  transactions: Transaction[],
  historicalPrices: Record<string, { date: string; close: number }[]>
): { date: string; value: number; cost: number }[] {
  if (transactions.length === 0) return [];

  // Build a sorted list of all unique dates from price history
  const allDatesSet = new Set<string>();
  Object.values(historicalPrices).forEach(prices => {
    prices.forEach(p => allDatesSet.add(p.date));
  });
  const allDates = Array.from(allDatesSet).sort();

  if (allDates.length === 0) return [];

  // Build price lookup: ticker -> date -> price
  const priceLookup: Record<string, Record<string, number>> = {};
  Object.entries(historicalPrices).forEach(([ticker, prices]) => {
    priceLookup[ticker] = {};
    prices.forEach(p => {
      priceLookup[ticker][p.date] = p.close;
    });
  });

  const history: { date: string; value: number; cost: number }[] = [];

  for (const date of allDates) {
    // Calculate holdings as of this date
    const holdings = new Map<string, { shares: number; cost: number }>();

    for (const tx of transactions) {
      if (tx.date > date) break;
      const h = holdings.get(tx.ticker) || { shares: 0, cost: 0 };
      if (tx.type === 'BUY') {
        h.cost += tx.quantity * tx.price + getTransactionFee(tx.commission);
        h.shares += tx.quantity;
      } else {
        if (h.shares > 0) {
          const costPerShare = h.cost / h.shares;
          h.shares -= tx.quantity;
          h.cost = h.shares * costPerShare;
        }
      }
      holdings.set(tx.ticker, h);
    }

    // Calculate total value
    let totalValue = 0;
    let totalCost = 0;
    holdings.forEach((h, ticker) => {
      if (h.shares <= 0) return;
      const price = priceLookup[ticker]?.[date];
      if (price !== undefined) {
        totalValue += h.shares * price;
      }
      totalCost += h.cost;
    });

    if (totalValue > 0) {
      history.push({ date, value: totalValue, cost: totalCost });
    }
  }

  return history;
}



/**
 * Calculates Simple Return (ROI) history.
 * ROI = (Current Value - Total Cost) / Total Cost
 * This reflects the actual profit percentage relative to total money spent.
 */
export function calculateSimpleROIHistory(
  history: { date: string; value: number; cost: number }[]
): { date: string; roi: number }[] {
  if (history.length === 0) return [];

  return history.map(point => ({
    date: point.date,
    roi: point.cost > 0 ? ((point.value - point.cost) / point.cost) * 100 : 0
  }));
}

// ── Format Helpers (cached formatters for performance) ────────

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format as currency ($xx.xx) — for totals, market values, etc. */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

/** Format as price ($xx.xxxx) — for per-share prices, avg cost, etc. */
export function formatPrice(value: number): string {
  return priceFormatter.format(value);
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

const numberFormatters = new Map<number, Intl.NumberFormat>();

export function formatNumber(value: number, decimals = 2): string {
  let formatter = numberFormatters.get(decimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    numberFormatters.set(decimals, formatter);
  }
  return formatter.format(value);
}





