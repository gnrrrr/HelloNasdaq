export interface Transaction {
  id: string;
  ticker: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  date: string; // ISO date string
  commission?: number;
  notes?: string;
}

export interface Position {
  ticker: string;
  name: string;
  totalShares: number;
  avgCost: number;
  currentPrice: number;
  currentValue: number;
  totalCost: number;
  returnAmt: number;
  returnPct: number;
  dayChange: number;
  dayChangePct: number;
  netAddedToday: number;
  weight: number; // percentage of portfolio
  hasSplit?: boolean;
  splitRatio?: number;
}

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  previousClose: number;
}

export interface HistoricalPrice {
  date: string;
  close: number;
}



export interface CashFlow {
  date: string;
  amount: number; // negative for outflows (buys), positive for inflows (sells)
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}




