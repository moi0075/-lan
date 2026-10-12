import { countries } from "../data/catalog";
import type { LearningState } from "../engine/learning";
import { unlockProgress } from "../engine/unlockProgress";
import "./UnlockProgress.css";

export default function UnlockProgress({
  learning,
  justUnlocked = 0,
}: {
  learning: LearningState;
  justUnlocked?: number;
}) {
  const progress = unlockProgress(learning, countries);
  const percent = justUnlocked ? 100 : progress.percent;
  const label = justUnlocked
    ? `${justUnlocked} nouveaux pays débloqués`
    : progress.nextCount
      ? `Progression vers les ${progress.nextCount} prochains pays`
      : "Tous les pays sont débloqués";
  return (
    <div
      className="unlock-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      aria-valuetext={`${label} · ${Math.round(percent)} %`}
      title={`${label} · ${Math.round(percent)} %`}
    >
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}
