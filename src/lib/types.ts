import type { TxType } from "./parser";

export interface Ledger {
  id: string;
  source_id: string;
  source_type: string;
  name: string;
  currency: string;
  timezone: string;
  owner_user_id: string | null;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface TxRow {
  id: string;
  ledger_id: string;
  user_id: string | null;
  display_name: string | null;
  type: TxType;
  amount: number;
  item: string;
  cat: string | null;
  sub: string | null;
  note: string | null;
  occurred_at: string;
  source_message_id: string | null;
  raw_text: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface KeywordRow {
  id: string;
  ledger_id: string | null;
  keyword: string;
  type: TxType;
  cat: string;
  sub: string | null;
  emoji: string | null;
  source: string;
  hits: number;
}

export interface BudgetRow {
  id: string;
  ledger_id: string;
  cat: string | null;
  period: string;
  amount: number;
}
