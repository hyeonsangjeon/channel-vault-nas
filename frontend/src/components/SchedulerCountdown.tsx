import { useEffect, useState } from "react";

import { useI18n } from "../i18n";

type SchedulerStatus = {
  running: boolean;
  next_tick_at: string | null;
};

export function SchedulerCountdown({ status }: { status: SchedulerStatus | null | undefined }) {
  const { t: translate } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  const nextTickAt = status?.next_tick_at;
  const running = status?.running;

  useEffect(() => {
    setNow(Date.now());
    if (!nextTickAt || running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [nextTickAt, running]);

  if (!status) return translate("runtime.checking");
  if (running) return translate("runtime.scheduler.runningNow");
  if (!nextTickAt) return translate("runtime.scheduler.none");
  const seconds = Math.max(0, Math.ceil((new Date(nextTickAt).getTime() - now) / 1_000));
  if (seconds <= 0) return translate("runtime.scheduler.due");
  if (seconds < 60) return translate("runtime.scheduler.inSeconds").replace("{seconds}", String(seconds));
  return translate("runtime.scheduler.inMinutes")
    .replace("{minutes}", String(Math.floor(seconds / 60)))
    .replace("{seconds}", String(seconds % 60));
}
