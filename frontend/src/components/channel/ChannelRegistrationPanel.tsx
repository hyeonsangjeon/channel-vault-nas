import {
  CheckCircle2,
  ChevronDown,
  FolderTree,
  HardDrive,
  Link2,
  Sparkles,
  X,
} from "lucide-react";
import type { FormEvent } from "react";

import type { ChannelProbeResult } from "../../api/channels";
import type { TranslationKey } from "../../i18n";

type RegistrationStatus = "idle" | "probing" | "ready" | "committing" | "registered" | "error";
type Translate = (key: TranslationKey) => string;

type ChannelRegistrationPanelProps = {
  audioOnly: boolean;
  error: string;
  isAdditionalChannel: boolean;
  maxQuality: string;
  onAudioOnlyChange: (checked: boolean) => void;
  onClose: () => void;
  onCommit: () => void;
  onMaxQualityChange: (quality: string) => void;
  onSourceValueChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSubtitlesChange: (checked: boolean) => void;
  probe: ChannelProbeResult | null;
  qualityOptions: string[];
  sourceValue: string;
  status: RegistrationStatus;
  subtitlesEnabled: boolean;
  t: Translate;
};

export function ChannelRegistrationPanel({
  audioOnly,
  error,
  isAdditionalChannel,
  maxQuality,
  onAudioOnlyChange,
  onClose,
  onCommit,
  onMaxQualityChange,
  onSourceValueChange,
  onSubmit,
  onSubtitlesChange,
  probe,
  qualityOptions,
  sourceValue,
  status,
  subtitlesEnabled,
  t,
}: ChannelRegistrationPanelProps) {
  const isProbing = status === "probing";
  const isCommitting = status === "committing";
  const previewInitials = getInitials(probe?.title ?? "Channel Vault");

  return (
    <section
      aria-label={t("registration.hero.title")}
      className={`panel channel-registration-panel${isAdditionalChannel ? " is-additional" : ""}`}
    >
      <header className="channel-registration-header">
        <div>
          <h2>{isAdditionalChannel ? t("registration.addAnother") : t("registration.hero.title")}</h2>
          <p>{isAdditionalChannel ? t("registration.addAnotherDetail") : t("registration.hero.subtitle")}</p>
        </div>
        {isAdditionalChannel ? (
          <button aria-label={t("registration.hideComposer")} className="icon-button" onClick={onClose} type="button">
            <X size={16} />
          </button>
        ) : null}
      </header>

      <form className="channel-registration-command" onSubmit={onSubmit}>
        <label className="channel-registration-input">
          <Link2 size={18} />
          <input
            aria-label={t("registration.input.aria")}
            onChange={(event) => onSourceValueChange(event.target.value)}
            placeholder={t("registration.input.placeholder")}
            value={sourceValue}
          />
        </label>
        <button className="primary-action channel-registration-preview" disabled={isProbing} type="submit">
          <Sparkles size={16} />
          {isProbing ? t("registration.probing") : t("registration.probe")}
        </button>
      </form>

      <div aria-label={t("registration.steps.aria")} className="channel-registration-steps">
        <span><b>1</b>{t("registration.steps.check")}</span>
        <i />
        <span><b>2</b>{t("registration.steps.register")}</span>
        <i />
        <span><b>3</b>{t("registration.steps.backup")}</span>
      </div>

      <details className="channel-registration-options">
        <summary>
          <span>{t("registration.options")}</span>
          <ChevronDown size={15} />
        </summary>
        <div>
          <div className="quality-segment" aria-label={t("registration.quality")}>
            {qualityOptions.map((quality) => (
              <button
                className={quality === maxQuality ? "active" : ""}
                key={quality}
                onClick={() => onMaxQualityChange(quality)}
                type="button"
              >
                {quality}
              </button>
            ))}
          </div>
          <label className="registration-toggle">
            <input checked={audioOnly} onChange={(event) => onAudioOnlyChange(event.target.checked)} type="checkbox" />
            {t("registration.audioOnly")}
          </label>
          <label className="registration-toggle">
            <input
              checked={subtitlesEnabled}
              onChange={(event) => onSubtitlesChange(event.target.checked)}
              type="checkbox"
            />
            {t("registration.subtitles")}
          </label>
        </div>
      </details>

      {error ? <div className="registration-error">{error}</div> : null}

      {probe ? (
        <div className="channel-registration-result">
          <p>{t("registration.previewResult")}</p>
          <div className="channel-registration-identity">
            <span className="channel-registration-avatar">{previewInitials}</span>
            <div>
              <strong>{probe.title}</strong>
              <small>{probe.handle ?? probe.normalized.identifier}</small>
            </div>
          </div>
          <dl className="channel-registration-facts">
            <div>
              <dt>{t("registration.videos")}</dt>
              <dd>{probe.video_count}</dd>
            </div>
            <div>
              <dt>{t("registration.estimatedStorage")}</dt>
              <dd>{probe.storage_forecast.estimated_label}</dd>
            </div>
            <div>
              <dt>{t("registration.destination")}</dt>
              <dd><FolderTree size={14} />{probe.folder_preview.channel_dir}</dd>
            </div>
          </dl>
          <div className="channel-registration-videos">
            {probe.videos.slice(0, 3).map((video) => (
              <a href={video.url} key={video.external_id} rel="noreferrer" target="_blank">
                <strong>{video.title}</strong>
                <span>{video.external_id}</span>
              </a>
            ))}
          </div>
          <button className="primary-action channel-registration-commit" disabled={isCommitting} onClick={onCommit} type="button">
            {isCommitting ? <Sparkles size={16} /> : <CheckCircle2 size={16} />}
            {isCommitting ? t("registration.committing") : t("registration.commit")}
          </button>
        </div>
      ) : null}

      <div className="channel-registration-trust">
        <span><CheckCircle2 size={16} />{t("registration.trust.skip")}</span>
        <span><HardDrive size={16} />{t("registration.trust.index")}</span>
      </div>
    </section>
  );
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((token) => token[0]?.toUpperCase())
    .join("") || "CV";
}
