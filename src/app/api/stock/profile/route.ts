import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return Response.json({ error: 'symbol parameter required' }, { status: 400 });
  }

  try {
    // Try both assetProfile and summaryProfile as some tickers use one or the other
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol.toUpperCase()}?modules=assetProfile,summaryProfile`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      next: { revalidate: 86400 }, // Cache for 24 hours as sector rarely changes
    });

    if (!res.ok) {
      return Response.json({ error: 'Failed to fetch profile' }, { status: res.status });
    }

    const data = await res.json();
    const result = data?.quoteSummary?.result?.[0];
    const profile = result?.assetProfile || result?.summaryProfile;

    if (!profile) {
      return Response.json({ error: 'No profile found' }, { status: 404 });
    }

    return Response.json({
      symbol: symbol.toUpperCase(),
      sector: profile.sector || 'Other',
      industry: profile.industry || 'Other',
      longBusinessSummary: profile.longBusinessSummary || '',
    });
  } catch {
    return Response.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}
