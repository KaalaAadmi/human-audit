import * as Notifications from 'expo-notifications';

export const DEFAULT_REMINDER_START_MIN = 480;  // 8:00 AM
export const DEFAULT_REMINDER_END_MIN = 1320;   // 10:00 PM

/** Minutes from midnight -> "8:00 AM". */
export const fmtMin = (m: number) => {
  const h = Math.floor(m / 60) % 24; // 1440 (end of day) shows as 12:00 AM
  return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/** Minutes from midnight -> a Date today at that local time (what the time picker wants). */
export const minToDate = (m: number) => {
  const d = new Date();
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
};

/** Minutes-from-midnight of every reminder: start, start+interval, ... up to and including end. */
export function reminderSlots(startMin: number, endMin: number, intervalMins: number): number[] {
  const step = Math.max(30, intervalMins); // floor keeps us well under iOS's 64 pending-notification cap
  const slots: number[] = [];
  for (let m = startMin; m <= endMin && m < 1440; m += step) slots.push(m); // 1440 = midnight end, not a valid trigger hour
  return slots;
}

/** Replaces all scheduled reminders. Pass enabled=false to just clear them. */
export async function scheduleWaterReminders(enabled: boolean, startMin: number, endMin: number, intervalMins: number) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!enabled) return;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  for (const m of reminderSlots(startMin, endMin, intervalMins)) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💧 HumanAudit Hydration Reminder',
        body: 'Time to hydrate! Drink some water to keep your recovery and cellular age optimal.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: Math.floor(m / 60),
        minute: m % 60,
      },
    });
  }
}

// ponytail: runnable check — `npx tsx services/waterReminders.ts` (expo-notifications import needs RN, so run via a stub if it fails)
// @ts-ignore
if (typeof require !== 'undefined' && require.main === module) {
  const s = reminderSlots(480, 1320, 90);
  if (s.length !== 10 || s[0] !== 480 || s.at(-1) !== 1290) throw new Error('reminderSlots default window wrong');
  if (reminderSlots(600, 660, 90).join() !== '600') throw new Error('reminderSlots short window wrong');
  if (reminderSlots(480, 1320, 5)[1] !== 510) throw new Error('reminderSlots floor wrong');
  console.log('waterReminders: ok');
}
