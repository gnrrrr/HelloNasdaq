import { Transaction } from './types';

// ── Shared Storage API ─────────────────────────────────────────
// This replaces localStorage to allow multi-browser/account sync

export async function getTransactions(): Promise<Transaction[]> {
  try {
    const res = await fetch('/api/storage');
    const data = await res.json();
    return data.transactions || [];
  } catch {
    return [];
  }
}

export async function saveTransactions(transactions: Transaction[]): Promise<void> {
  try {
    await fetch('/api/storage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions }),
    });
  } catch (error) {
    console.error('Failed to save shared database:', error);
  }
}

export async function addTransaction(transaction: Transaction): Promise<Transaction[]> {
  const transactions = await getTransactions();
  transactions.push(transaction);
  transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  await saveTransactions(transactions);
  return transactions;
}

export async function updateTransaction(updated: Transaction): Promise<Transaction[]> {
  const transactions = (await getTransactions()).map(t =>
    t.id === updated.id ? updated : t
  );
  transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  await saveTransactions(transactions);
  return transactions;
}

export async function deleteTransaction(id: string): Promise<Transaction[]> {
  const transactions = (await getTransactions()).filter(t => t.id !== id);
  await saveTransactions(transactions);
  return transactions;
}

// ── Legacy / Init ──────────────────────────────────────────────

export async function loadSharedData(): Promise<Transaction[]> {
  // Just a wrapper for the same API
  return getTransactions();
}
