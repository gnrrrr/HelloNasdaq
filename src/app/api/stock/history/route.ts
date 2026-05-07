import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const RANGE_MAP: Record<string, string> = {
  '1M': '1mo',
  '3M': '3mo',
  '6M': '6mo',
  '1Y': '1y',
  '2Y': '2y',
  '5Y': '5y',
  'ALL': 'max',
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');
  const period = searchParams.get('period') || '1Y';

  if (!symbol) {
    return Response.json({ error: 'symbol parameter required' }, { status: 400 });
  }

  const range = RANGE_MAP[period] || '1y';

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}?interval=1d&range=${range}&events=split`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      next: { revalidate: 300 }, // cache for 5 minutes
    });

    if (!res.ok) {
      return Response.json({ error: 'Failed to fetch history' }, { status: res.status });
    }

    const data = await res.json();
    const chart = data?.chart?.result?.[0];

    if (!chart) {
      return Response.json({ error: 'No data found' }, { status: 404 });
    }

    const timestamps = chart.timestamp || [];
    const closes = chart.indicators?.quote?.[0]?.close || [];
    const opens = chart.indicators?.quote?.[0]?.open || [];

    const prices: { date: string; close: number; open: number }[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] != null && opens[i] != null) {
        const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
        prices.push({ date, close: closes[i], open: opens[i] });
      }
    }

    // Extract splits
    const splits: { ticker: string; date: string; ratio: number }[] = [];
    const splitData = chart.events?.splits;
    if (splitData) {
      Object.values(splitData).forEach((s: any) => {
        const ratio = s.numerator / s.denominator;
        const date = new Date(s.date * 1000).toISOString().split('T')[0];
        splits.push({ ticker: symbol.toUpperCase(), date, ratio });
      });
    }

    return Response.json({
      symbol: symbol.toUpperCase(),
      prices,
      splits,
    });
  } catch {
    return Response.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
