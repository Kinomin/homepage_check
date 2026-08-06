/**
 * デモデータで動作していることの明示。
 * 架空のサンプルを分析結果として提示させないため、必ず画面上部に出す。
 */
export function DemoNote({ isDemo }: { isDemo: boolean }) {
  if (!isDemo) return null;
  return (
    <div className="demo-note">
      Supabase が未接続のため、プロトタイプ由来のサンプルデータを表示しています。学校名・数値・判定結果はすべて架空です。
    </div>
  );
}
