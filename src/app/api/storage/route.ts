import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

const DB_PATH = path.join(process.cwd(), 'src/data/portfolio.json');

// Ensure the data directory and file exist
async function ensureDb() {
  const dir = path.dirname(DB_PATH);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }

  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify({ transactions: [] }, null, 2));
  }
}

export async function GET() {
  try {
    await ensureDb();
    const data = await fs.readFile(DB_PATH, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read database' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDb();
    const body = await request.json();
    
    if (!body.transactions) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    await fs.writeFile(DB_PATH, JSON.stringify(body, null, 2));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save to database' }, { status: 500 });
  }
}
