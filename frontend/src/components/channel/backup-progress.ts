import type { ChannelCoverage } from "../../api/channels";

export function backupProgress(coverage: ChannelCoverage | null) {
  const total = coverage?.source ?? 0;
  const downloaded = coverage?.archived ?? 0;
  const remaining = coverage?.missing ?? 0;
  return {
    checked: coverage !== null,
    total,
    downloaded,
    remaining,
    unavailable: Math.max(0, total - downloaded - remaining),
    complete: total > 0 && downloaded === total && remaining === 0,
  };
}
