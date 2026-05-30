import {
  Activity,
  Archive,
  CalendarDays,
  Clock3,
  Database,
  Download,
  FileArchive,
  FileText,
  Film,
  Folder,
  FolderTree,
  Languages,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  TimerReset,
} from "lucide-react";
import { motion } from "framer-motion";
import { ChannelConstellation } from "./components/ChannelConstellation";
import { MetricTile } from "./components/MetricTile";
import { QueueFlow } from "./components/QueueFlow";
import {
  backupStats,
  fidelityChecks,
  folderPreview,
  importOptions,
  mockActivity,
  mockChannels,
  mockLinks,
  mockMetrics,
  mockQueue,
  uploadRhythm,
} from "./data/observatory";
import { languages, useI18n, type Language, type TranslationKey } from "./i18n";

const navItems: { key: TranslationKey; id: string }[] = [
  { key: "nav.dashboard", id: "dashboard" },
  { key: "nav.channels", id: "channels" },
  { key: "nav.library", id: "library" },
  { key: "nav.queue", id: "queue" },
  { key: "nav.insights", id: "insights" },
  { key: "nav.settings", id: "settings" },
];

function App() {
  const { language, setLanguage, t } = useI18n();

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label={t("nav.dashboard")}>
        <div className="brand-block">
          <div className="brand-mark">
            <Archive size={21} strokeWidth={2.2} />
          </div>
          <div>
            <p className="brand-title">{t("brand.title")}</p>
            <p className="brand-subtitle">{t("brand.subtitle")}</p>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <button className={item.id === "dashboard" ? "nav-item active" : "nav-item"} key={item.id}>
              {t(item.key)}
            </button>
          ))}
        </nav>

        <div className="sidebar-status">
          <div className="status-dot" />
          <div>
            <strong>{t("sidebar.status.title")}</strong>
            <span>{t("sidebar.status.detail")}</span>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{t("topbar.eyebrow")}</p>
            <h1>{t("topbar.title")}</h1>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" title={t("actions.search")} aria-label={t("actions.search")}>
              <Search size={18} />
            </button>
            <button className="icon-button" title={t("actions.refresh")} aria-label={t("actions.refresh")}>
              <RotateCcw size={18} />
            </button>
            <label className="language-control" title={t("actions.language")}>
              <Languages size={16} />
              <select
                aria-label={t("actions.language")}
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
              >
                {Object.entries(languages).map(([code, label]) => (
                  <option key={code} value={code}>
                    {code.toUpperCase()} · {label}
                  </option>
                ))}
              </select>
            </label>
            <button className="command-button">
              <Settings size={16} />
              {t("actions.policies")}
            </button>
          </div>
        </header>

        <section className="metric-grid" aria-label={t("metrics.aria")}>
          {mockMetrics.map((metric, index) => (
            <MetricTile metric={metric} index={index} key={metric.labelKey} />
          ))}
        </section>

        <section className="backup-grid">
          <motion.div
            className="panel backup-panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.45 }}
          >
            <div className="panel-header compact">
              <div className="channel-brief">
                <div className="channel-avatar">DL</div>
                <div>
                  <p className="panel-kicker">{t("panel.backup.kicker")}</p>
                  <h2>Deep Lab</h2>
                  <span>@deeplab.archive · {t("backup.ownerMode")}</span>
                </div>
              </div>
              <ShieldCheck size={20} className="panel-icon emerald" />
            </div>
            <div className="backup-stats">
              {backupStats.map((stat) => (
                <article className="backup-stat" key={stat.labelKey}>
                  <span>{t(stat.labelKey)}</span>
                  <strong>{stat.value}</strong>
                  <small>{t(stat.detailKey)}</small>
                </article>
              ))}
            </div>
            <div className="cadence-block">
              <div>
                <p className="panel-kicker">{t("panel.cadence.kicker")}</p>
                <h3>{t("panel.cadence.title")}</h3>
                <div className="cadence-meta">
                  <span><Clock3 size={14} /> {t("cadence.latest")}</span>
                  <span><TimerReset size={14} /> {t("cadence.next")}</span>
                </div>
              </div>
              <div className="cadence-strip" aria-label={t("panel.cadence.title")}>
                {uploadRhythm.map((day) => (
                  <div className="cadence-day" key={day.labelKey}>
                    <span>{t(day.labelKey)}</span>
                    <i style={{ height: `${Math.max(18, day.intensity * 88)}px` }} />
                    <strong>{day.count}</strong>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            className="panel folder-panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.45 }}
          >
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">{t("panel.folder.kicker")}</p>
                <h2>{t("panel.folder.title")}</h2>
              </div>
              <FolderTree size={20} className="panel-icon" />
            </div>
            <code className="folder-root">/downfolder/channels/@deeplab [UC8_DEMO]/2026</code>
            <div className="folder-tree" aria-label={t("panel.folder.title")}>
              {folderPreview.map((item) => (
                <div className={`folder-row folder-${item.kind}`} key={`${item.depth}-${item.name}`}>
                  <span style={{ width: `${item.depth * 18}px` }} />
                  {item.kind === "file" ? <FileText size={15} /> : <Folder size={15} />}
                  <code>{item.name}</code>
                </div>
              ))}
            </div>
            <div className="fidelity-list" aria-label={t("panel.fidelity.title")}>
              <p className="panel-kicker">{t("panel.fidelity.kicker")}</p>
              {fidelityChecks.map((item) => (
                <span className={`fidelity-pill ${item.status}`} key={item.labelKey}>
                  <ShieldCheck size={14} />
                  {t(item.labelKey)}
                </span>
              ))}
            </div>
            <div className="folder-meta">
              <span><Film size={15} /> {t("folder.quality")}</span>
              <span><CalendarDays size={15} /> {t("folder.template")}</span>
            </div>
          </motion.div>
        </section>

        <section className="observatory-grid">
          <motion.div
            className="panel constellation-panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.45 }}
          >
            <div className="panel-header">
              <div>
                <p className="panel-kicker">{t("panel.channelHealth.kicker")}</p>
                <h2>{t("panel.channelHealth.title")}</h2>
              </div>
              <div className="legend-row">
                <span><i className="legend-dot healthy" /> {t("legend.healthy")}</span>
                <span><i className="legend-dot warning" /> {t("legend.pressure")}</span>
                <span><i className="legend-dot failed" /> {t("legend.failed")}</span>
              </div>
            </div>
            <ChannelConstellation channels={mockChannels} links={mockLinks} />
          </motion.div>

          <motion.div
            className="panel queue-panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.45 }}
          >
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">{t("panel.liveJobs.kicker")}</p>
                <h2>{t("panel.liveJobs.title")}</h2>
              </div>
              <Activity size={20} className="panel-icon" />
            </div>
            <QueueFlow lanes={mockQueue} />
          </motion.div>
        </section>

        <section className="lower-grid">
          <motion.div
            className="panel activity-panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.45 }}
          >
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">{t("panel.recent.kicker")}</p>
                <h2>{t("panel.recent.title")}</h2>
              </div>
              <Clock3 size={20} className="panel-icon" />
            </div>
            <div className="activity-list">
              {mockActivity.map((item) => (
                <article className={`activity-row ${item.status}`} key={`${item.titleKey}-${item.timeKey}`}>
                  <span className="activity-state" />
                  <div>
                    <strong>{t(item.titleKey)}</strong>
                    <span>{item.channel}</span>
                  </div>
                  <time>{t(item.timeKey)}</time>
                </article>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="panel storage-panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34, duration: 0.45 }}
          >
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">{t("panel.storage.kicker")}</p>
                <h2>{t("panel.storage.title")}</h2>
              </div>
              <Database size={20} className="panel-icon" />
            </div>
            <div className="storage-map">
              {mockChannels.map((channel) => (
                <div
                  className={`storage-cell ${channel.health < 85 ? "warn" : ""}`}
                  key={channel.id}
                  style={{ flexGrow: channel.storageGb }}
                  title={`${channel.title}: ${channel.storageGb} GB`}
                >
                  <span>{channel.title}</span>
                  <strong>{channel.storageGb} {t("unit.gb")}</strong>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="panel quick-panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.45 }}
          >
            <div className="panel-header compact">
              <div>
                <p className="panel-kicker">{t("panel.import.kicker")}</p>
                <h2>{t("panel.import.title")}</h2>
              </div>
              <FileArchive size={20} className="panel-icon violet" />
            </div>
            <div className="import-list">
              {importOptions.map((item) => (
                <article className={`import-row ${item.tone}`} key={item.labelKey}>
                  <span className="import-state" />
                  <div>
                    <strong>{t(item.labelKey)}</strong>
                    <small>{t(item.detailKey)}</small>
                  </div>
                  <em>{t(item.statusKey)}</em>
                </article>
              ))}
            </div>
            <button className="primary-action">
              <Download size={16} />
              {t("import.review")}
            </button>
          </motion.div>
        </section>
      </section>
    </main>
  );
}

export default App;
