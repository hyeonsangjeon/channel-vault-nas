import {
  CirclePause,
  Clock3,
  Download,
  Library,
  RefreshCcw,
  Save,
} from "lucide-react";

import type { TranslationKey } from "../../i18n";

type Translate = (key: TranslationKey) => string;

type ChannelBackupOverviewProps = {
  attention: boolean;
  applying: boolean;
  complete: boolean;
  dirty: boolean;
  downloaded: number;
  failedCount: number;
  handle: string;
  initials: string;
  intervalMinutes: number;
  lastRun: string;
  limit: number;
  manualDisabled: boolean;
  nextRun: string;
  onCheckNow: () => void;
  onIntervalChange: (minutes: number) => void;
  onLimitChange: (limit: number) => void;
  onManualTest: () => void;
  onOpenLibrary: () => void;
  onOpenSettings: () => void;
  onRetryFailed: () => void;
  onStart: () => void;
  onStop: () => void;
  onUpdate: () => void;
  remaining: number;
  schedulerEnabled: boolean;
  schedulerRunning: boolean;
  statusMessage: string;
  t: Translate;
  title: string;
  total: number;
};

const intervalPresets = [15, 30, 60, 360, 720, 1440];
const limitPresets = [1, 3, 5, 10, 20];

export function ChannelBackupOverview({
  attention,
  applying,
  complete,
  dirty,
  downloaded,
  failedCount,
  handle,
  initials,
  intervalMinutes,
  lastRun,
  limit,
  manualDisabled,
  nextRun,
  onCheckNow,
  onIntervalChange,
  onLimitChange,
  onManualTest,
  onOpenLibrary,
  onOpenSettings,
  onRetryFailed,
  onStart,
  onStop,
  onUpdate,
  remaining,
  schedulerEnabled,
  schedulerRunning,
  statusMessage,
  t,
  title,
  total,
}: ChannelBackupOverviewProps) {
  const intervals = withCurrent(intervalPresets, intervalMinutes);
  const limits = withCurrent(limitPresets, limit);
  const isRunning = schedulerEnabled && schedulerRunning;

  return (
    <section className="channel-backup-overview">
      <header className="channel-backup-identity-row">
        <div className="channel-backup-identity">
          <span>{initials}</span>
          <div>
            <h2>{title}</h2>
            <p>{handle}</p>
          </div>
        </div>
        <dl className="channel-backup-counts" aria-label={t("detail.automation.counts")}>
          <div><dt>{t("detail.automation.totalVideos")}</dt><dd>{total}</dd></div>
          <div><dt>{t("detail.automation.downloadedVideos")}</dt><dd>{downloaded}</dd></div>
          <div><dt>{t("detail.automation.remainingVideos")}</dt><dd>{remaining}</dd></div>
        </dl>
      </header>

      <div className="channel-backup-command">
        <div className="channel-backup-copy">
          <h3>
            {(complete ? t("detail.simple.completeTitle") : t("detail.simple.title")).replace(
              "{remaining}",
              String(remaining),
            )}
          </h3>
          <p>
            {(complete ? t("detail.simple.completeSubtitle") : t("detail.simple.subtitle"))
              .replace("{downloaded}", String(downloaded))
              .replace("{remaining}", String(remaining))}
          </p>
        </div>

        <div className="channel-backup-controls">
          {!schedulerEnabled ? (
            <button className="primary-action channel-backup-start" disabled={applying} onClick={onStart} type="button">
              <Download size={18} />
              {applying
                ? t("detail.simple.starting")
                : complete
                  ? t("detail.simple.startFuture")
                  : t("detail.simple.start")}
            </button>
          ) : dirty ? (
            <button className="primary-action channel-backup-start" disabled={applying} onClick={onUpdate} type="button">
              <Save size={18} />
              {applying ? t("detail.simple.saving") : t("detail.simple.save")}
            </button>
          ) : null}

          <label className="channel-backup-select">
            <span>{t("detail.simple.interval")}</span>
            <select onChange={(event) => onIntervalChange(Number(event.target.value))} value={intervalMinutes}>
              {intervals.map((minutes) => (
                <option key={minutes} value={minutes}>{formatInterval(minutes, t)}</option>
              ))}
            </select>
          </label>
          <label className="channel-backup-select">
            <span>{t("detail.simple.batch")}</span>
            <select onChange={(event) => onLimitChange(Number(event.target.value))} value={limit}>
              {limits.map((count) => (
                <option key={count} value={count}>{t("detail.simple.batchValue").replace("{count}", String(count))}</option>
              ))}
            </select>
          </label>
          {schedulerEnabled ? (
            <button className="command-button channel-backup-secondary-check" disabled={applying} onClick={onCheckNow} type="button">
              <RefreshCcw size={16} />
              {t("detail.simple.check")}
            </button>
          ) : null}
        </div>

      </div>

      <div
        className={`channel-backup-status${isRunning ? " is-running" : ""}${attention ? " is-attention" : ""}${!schedulerEnabled ? " is-paused" : ""}`}
        role="status"
      >
          <RefreshCcw size={25} />
          <div>
            <strong>
              {attention
                ? t("detail.simple.attentionTitle")
                : isRunning
                  ? t("detail.simple.runningTitle")
                  : schedulerEnabled
                    ? t("detail.simple.activeTitle")
                    : t("detail.simple.pausedTitle")}
            </strong>
            <small>
              {attention
                ? statusMessage || t("detail.simple.attentionDetail")
                : schedulerEnabled
                  ? t("detail.simple.activeDetail")
                  : t("detail.simple.pausedDetail")}
            </small>
          </div>
          {schedulerEnabled && !attention ? (
            <>
              <span>
                <small>{t("detail.simple.nextRun")}</small>
                <strong>{nextRun}</strong>
              </span>
              <button aria-label={t("detail.simple.pause")} className="command-button" disabled={applying} onClick={onStop} title={t("detail.simple.pause")} type="button">
                <CirclePause size={16} />
                {t("detail.simple.pause")}
              </button>
            </>
          ) : null}
          {attention ? (
            <button
              className="command-button channel-backup-attention-action"
              disabled={applying}
              onClick={failedCount > 0 ? onRetryFailed : onOpenSettings}
              type="button"
            >
              <RefreshCcw size={16} />
              {failedCount > 0
                ? t("detail.simple.retryFailed").replace("{count}", String(failedCount))
                : t("detail.simple.openSettings")}
            </button>
          ) : null}
      </div>

      {statusMessage && !attention ? <div className="channel-backup-message" role="status">{statusMessage}</div> : null}

      <details className="channel-backup-advanced">
        <summary>
          <span>{t("detail.simple.advanced")}</span>
          <small>{t("detail.simple.advancedDetail")}</small>
        </summary>
        <div>
          <button className="command-button" disabled={manualDisabled} onClick={onManualTest} type="button">
            <Download size={15} />
            {t("detail.simple.manual")}
          </button>
          <button className="command-button" onClick={onOpenLibrary} type="button">
            <Library size={15} />
            {t("detail.simple.openLibrary")}
          </button>
          <span><Clock3 size={14} />{t("detail.simple.lastRun")} · {lastRun}</span>
        </div>
      </details>
    </section>
  );
}

function withCurrent(values: number[], current: number) {
  return values.includes(current) ? values : [...values, current].sort((a, b) => a - b);
}

function formatInterval(minutes: number, t: Translate) {
  if (minutes % 1440 === 0) {
    return t("detail.simple.days").replace("{count}", String(minutes / 1440));
  }
  if (minutes % 60 === 0) {
    return t("detail.simple.hours").replace("{count}", String(minutes / 60));
  }
  return t("detail.simple.minutes").replace("{count}", String(minutes));
}
