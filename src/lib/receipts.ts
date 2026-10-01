// Columns the app may read from receipts — the hidden `serial` is ኦዲት-only (RPC).
export const RECEIPT_COLS =
  'id, code, kind, dept, amount, payer_name, payer_phone, method, txn_ref, account_label, purpose, received_on, issued_at, print_count, voided_at, void_reason, verified_by, issued_by, term_id, earning_id, donation_id, audited_at';
