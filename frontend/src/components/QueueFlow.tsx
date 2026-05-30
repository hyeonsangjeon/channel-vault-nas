import type { QueueLane } from "../data/observatory";
import { useI18n } from "../i18n";

export function QueueFlow({ lanes }: { lanes: QueueLane[] }) {
  const { t } = useI18n();
  const total = lanes.reduce((sum, lane) => sum + lane.count, 0);

  return (
    <div className="queue-flow">
      {lanes.map((lane, index) => {
        const width = Math.max(12, (lane.count / Math.max(total, 1)) * 100);
        return (
          <div className="queue-lane" key={lane.labelKey}>
            <div className="queue-label">
              <span>{t(lane.labelKey)}</span>
              <strong>{lane.count}</strong>
            </div>
            <div className="queue-track">
              <span
                className={`queue-fill ${lane.status}`}
                style={{
                  width: `${width}%`,
                  transitionDelay: `${index * 70}ms`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
