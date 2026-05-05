import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbols = searchParams.get('symbols');

  if (!symbols) {
    return Response.json({ error: 'symbols parameter required' }, { status: 400 });
  }

  const symbolList = symbols.split(',').map(s => s.trim().toUpperCase());
  const results: Record<string, {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePct: number;
    previousClose: number;
  }> = {};

  try {
    const promises = symbolList.map(async (symbol) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`;
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          cache: 'no-store',
        });

        if (!res.ok) return;

        const data = await res.json();
        const chart = data?.chart?.result?.[0];
        if (!chart) return;

        const meta = chart.meta;
        const price = meta.regularMarketPrice ?? 0;
        const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
        const change = price - previousClose;
        const changePct = previousClose > 0 ? (change / previousClose) * 100 : 0;

        results[symbol] = {
          symbol,
          name: meta.shortName || meta.longName || symbol,
          price,
          change,
          changePct,
          previousClose,
        };
      } catch {
        // Skip failed symbols
      }
    });

    await Promise.all(promises);

    return Response.json(results);
  } catch {
    return Response.json({ error: 'Failed to fetch quotes' }, { status: 500 });
  }
}
