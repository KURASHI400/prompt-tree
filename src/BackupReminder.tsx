import { Link } from "react-router-dom";
import { useData } from "./useData";
import { settingsRepository } from "./local/repository/settingsRepository";
export function BackupReminder() {
  const { data } = useData("backup-reminder", () => settingsRepository.stats());
  if (
    !data?.cards ||
    (data.last_backup &&
      Date.now() - data.last_backup.at < 7 * 86400000 &&
      data.revision - data.last_backup.revision < 100)
  )
    return null;
  return (
    <p className="muted">
      <Link to="/settings">完全バックアップを保存してください</Link> ·
      この端末だけに保存されています
    </p>
  );
}
