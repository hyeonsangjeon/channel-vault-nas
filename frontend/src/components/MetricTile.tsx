import { AlertTriangle, CheckCircle2, DownloadCloud, HardDrive, RadioTower, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import type { ComponentType } from "react";
import type { ArchiveMetric, MetricTone } from "../data/observatory";
import { useI18n } from "../i18n";

const icons: Record<MetricTone, ComponentType<{ size?: number }>> = {
  good: CheckCircle2,
  info: RadioTower,
  active: DownloadCloud,
  protected: ShieldCheck,
  warn: HardDrive,
  bad: AlertTriangle,
};

export function MetricTile({ metric, index }: { metric: ArchiveMetric; index: number }) {
  const Icon = icons[metric.tone];
  const { t } = useI18n();

  return (
    <motion.article
      className={`metric-tile tone-${metric.tone}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
    >
      <div className="metric-topline">
        <span>{metric.label ?? (metric.labelKey ? t(metric.labelKey) : "")}</span>
        <Icon size={18} />
      </div>
      <strong>{metric.valueKey ? t(metric.valueKey) : metric.value}</strong>
      <p>{metric.detail ?? (metric.detailKey ? t(metric.detailKey) : "")}</p>
    </motion.article>
  );
}
