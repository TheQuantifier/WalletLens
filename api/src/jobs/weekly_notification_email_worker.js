import { listUsersWithNotificationEmailEnabled } from "../models/user.model.js";
import {
  listPendingWeeklyNotificationsForUser,
  markNotificationEmailDelivered,
} from "../models/notification.model.js";
import { sendEmail } from "../services/email.service.js";
import { query } from "../config/db.js";
import { isSystemHealthServiceDeactivated } from "../services/system_health_controls.service.js";
import { getRuntimeAppSettings } from "../services/app_settings_runtime.service.js";

let started = false;
let timer = null;
let isRunning = false;
let lastRunDateKey = "";
const WEEKLY_WORKER_LOCK_ID = 87342191;

function getLocalPartsForTimezone(date, timezone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const byType = Object.fromEntries(parts.map((item) => [item.type, item.value]));
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    dayOfWeek: weekdayMap[byType.weekday] ?? 0,
    dateKey: `${byType.year}-${byType.month}-${byType.day}`,
    hour: Number(byType.hour),
    minute: Number(byType.minute),
  };
}

function shouldRunDigestNow(settings, now = new Date()) {
  const day = Number(settings.weekly_digest_day_of_week);
  const [hourRaw, minuteRaw] = String(settings.weekly_digest_time || "09:00").split(":");
  const targetHour = Number(hourRaw);
  const targetMinute = Number(minuteRaw);
  const timezone = String(settings.weekly_digest_timezone || "America/Chicago");
  const local = getLocalPartsForTimezone(now, timezone);

  if (local.dayOfWeek !== day) return { run: false, dateKey: local.dateKey };
  if (!Number.isFinite(local.hour) || !Number.isFinite(local.minute)) {
    return { run: false, dateKey: local.dateKey };
  }
  if (local.hour !== targetHour || local.minute < targetMinute || local.minute >= targetMinute + 15) {
    return { run: false, dateKey: local.dateKey };
  }
  return { run: true, dateKey: local.dateKey };
}

function buildWeeklyDigestText(notifications = []) {
  const lines = ["Here are your latest updates from <AppName>:", ""];
  notifications.forEach((item, idx) => {
    const text = String(item?.message_text || "").trim();
    if (!text) return;
    lines.push(`${idx + 1}. ${text}`);
    lines.push("");
  });
  return lines.join("\n").trim();
}

export async function sendWeeklyNotificationEmailsNow() {
  if (await isSystemHealthServiceDeactivated("weekly_notification_worker")) {
    return {
      usersChecked: 0,
      usersEmailed: 0,
      usersFailed: 0,
      notificationsDelivered: 0,
      skipped: true,
      reason: "weekly_notification_worker_disconnected",
    };
  }
  const runtimeSettings = await getRuntimeAppSettings();
  if (runtimeSettings.pause_all_notifications) {
    return {
      usersChecked: 0,
      usersEmailed: 0,
      usersFailed: 0,
      notificationsDelivered: 0,
      skipped: true,
      reason: "notifications_paused",
    };
  }
  const users = await listUsersWithNotificationEmailEnabled();
  let usersEmailed = 0;
  let usersFailed = 0;
  let notificationsDelivered = 0;

  for (const user of users) {
    const allPending = await listPendingWeeklyNotificationsForUser(user.id, 200);
    const pending = runtimeSettings.pause_non_security_emails
      ? allPending.filter((item) => String(item.notification_type || "").toLowerCase() === "security")
      : allPending;
    if (!pending.length) continue;

    try {
      await sendEmail({
        to: user.email,
        subject: "Your weekly <AppName> updates",
        text: buildWeeklyDigestText(pending),
      });
      usersEmailed += 1;

      await Promise.all(
        pending.map((item) => markNotificationEmailDelivered(user.id, item.id))
      );
      notificationsDelivered += pending.length;
    } catch (err) {
      usersFailed += 1;
      console.error(
        `Weekly notification email failed for user ${user.id}:`,
        err?.message || err
      );
    }
  }

  return {
    usersChecked: users.length,
    usersEmailed,
    usersFailed,
    notificationsDelivered,
  };
}

async function workOnce() {
  if (isRunning) return;
  const runtimeSettings = await getRuntimeAppSettings();
  const schedule = shouldRunDigestNow(runtimeSettings, new Date());
  if (!schedule.run) {
    if (lastRunDateKey !== schedule.dateKey) {
      lastRunDateKey = "";
    }
    return;
  }
  if (lastRunDateKey === schedule.dateKey) return;

  isRunning = true;
  let lockAcquired = false;
  try {
    const lockResult = await query(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [WEEKLY_WORKER_LOCK_ID]
    );
    lockAcquired = Boolean(lockResult?.rows?.[0]?.locked);
    if (!lockAcquired) return;

    const summary = await sendWeeklyNotificationEmailsNow();
    lastRunDateKey = schedule.dateKey;
    if (summary.notificationsDelivered > 0 || summary.usersFailed > 0) {
      console.log(
        "Weekly notification email run:",
        JSON.stringify(summary)
      );
    }
  } finally {
    if (lockAcquired) {
      await query("SELECT pg_advisory_unlock($1)", [WEEKLY_WORKER_LOCK_ID]).catch(() => {});
    }
    isRunning = false;
  }
}

export function startWeeklyNotificationEmailWorker({ intervalMs = 15 * 60 * 1000 } = {}) {
  if (started) return;
  started = true;

  workOnce().catch((err) => {
    console.error("Weekly notification email worker startup error:", err);
  });

  timer = setInterval(() => {
    workOnce().catch((err) => {
      console.error("Weekly notification email worker loop error:", err);
    });
  }, Math.max(60 * 1000, Number(intervalMs) || 15 * 60 * 1000));
}

export function stopWeeklyNotificationEmailWorker() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  started = false;
}
