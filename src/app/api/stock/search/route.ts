import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get('q');

  if (!q || q.length < 1) {
    return Response.json([]);
  }

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      next: { revalidate: 3600 }, // cache for 1 hour
    });

    if (!res.ok) {
      return Response.json([]);
    }

    const data = await res.json();
    const quotes = data?.quotes || [];

    // Filter for major US exchanges only
    const US_EXCHANGES = ['NYQ', 'NMS', 'NGM', 'NCM', 'NAS', 'NYS', 'ARCA', 'BATS'];

    const results = quotes
      .filter((q: Record<string, string>) => 
        (q.quoteType === 'EQUITY' || q.quoteType === 'ETF') && 
        US_EXCHANGES.includes(q.exchange)
      )
      .map((q: Record<string, string>) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        exchange: q.exchange || '',
        type: q.quoteType || '',
      }));

    return Response.json(results);
  } catch {
    return Response.json([]);
  }
}
