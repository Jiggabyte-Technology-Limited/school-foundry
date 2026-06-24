/**
 * fees/reminders.ts — Overdue payment reminder stub.
 *
 * This module is a placeholder for future SMS/email reminder integration.
 * The computeOverdueAmount() function in balance.ts provides the data;
 * this module will send the actual notifications.
 *
 * Phase 4 plan:
 *   1. Query all students with overdue balances (daily cron).
 *   2. Generate reminder messages via template.
 *   3. Send via configured gateway (Twilio, Africa's Talking, WhatsApp Business API).
 *   4. Log each sent reminder in a new `reminder_log` table.
 */

import type { FeeEntry, PaymentEntry } from './balance';
import { computeOverdueAmount } from './balance';

export interface ReminderCandidate {
  student_id: number;
  student_name: string;
  guardian_name: string;
  guardian_contact: string;
  guardian_email: string;
  overdue_amount_cents: number;
  overdue_fees: FeeEntry[];
  days_overdue: number;
}

export interface ReminderResult {
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
}

/**
 * Find all students with overdue balances that should receive a reminder.
 * Returns a list of candidates with contact info and overdue details.
 *
 * @param options.min_days_overdue — minimum days past due before reminding (default: 7)
 * @param options.max_reminders_per_day — rate limit (default: 100)
 */
export async function findOverdueStudents(options?: {
  min_days_overdue?: number;
  max_reminders_per_day?: number;
}): Promise<ReminderCandidate[]> {
  // Phase 4: implement actual query against the database
  // This would join students + student_fees + payments + guardian info
  // and return students where overdue_amount > 0 AND days_overdue >= min_days_overdue
  void options;
  return [];
}

/**
 * Send a reminder to a specific student/guardian.
 * Stub: logs the reminder instead of sending.
 */
export async function sendReminder(candidate: ReminderCandidate): Promise<{ success: boolean; error?: string }> {
  // Phase 4: integrate with SMS/email gateway
  console.log(`[Reminders] Would send reminder to ${candidate.guardian_contact} for ${candidate.overdue_amount_cents} cents`);
  void candidate;
  return { success: true };
}

/**
 * Run the daily reminder batch.
 * Stub: returns empty result.
 */
export async function runReminderBatch(): Promise<ReminderResult> {
  return { sent: 0, failed: 0, skipped: 0, errors: [] };
}

// Re-export for convenience
export { computeOverdueAmount };
