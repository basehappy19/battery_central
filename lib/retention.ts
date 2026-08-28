// Shared BatteryLog retention policy.
//
// IMPORTANT: this used to be inconsistent — app/api/battery/update/route.ts
// purged a device's own logs older than 7 days on every single update,
// while app/api/logs/route.ts separately purged logs older than 90 days
// globally. The 7-day cutoff silently made the 7/30-day history graph
// (Feature 2) and the health score / charging profile analysis (Features 5
// & 12) impossible, since data never survived past a week. Both cleanup
// paths now share this single constant.
export const BATTERY_LOG_RETENTION_DAYS = 90;

export function retentionCutoffDate(days: number = BATTERY_LOG_RETENTION_DAYS): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
