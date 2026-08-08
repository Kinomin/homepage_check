/**
 * 実行の記録に残す区分（自動／手動）。
 *
 * 週1回の定期実行も CLI（scripts/scan-due.ts）を通るため、常に 'manual' で
 * 記録すると設定画面の実行履歴が全部「手動」になり、自動実行が動いているのか
 * 止まっているのかを画面から判断できなくなる。
 *
 * GitHub Actions はスケジュール起動のとき GITHUB_EVENT_NAME=schedule を渡す。
 * 別のスケジューラから回す場合は `--trigger cron` を付ける。
 */

export type ScanTrigger = 'cron' | 'manual';

export function resolveTrigger(
  argv: string[],
  env: Record<string, string | undefined>,
): ScanTrigger {
  const index = argv.indexOf('--trigger');
  const explicit = index === -1 ? undefined : argv[index + 1];
  if (explicit === 'cron' || explicit === 'manual') return explicit;
  return env.GITHUB_EVENT_NAME === 'schedule' ? 'cron' : 'manual';
}
