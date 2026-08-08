import { SignInForm } from '@/components/auth/SignInForm';
import { safeNextPath } from '@/lib/auth/redirect';
import { isAuthEnabled } from '@/lib/auth/session';

export const metadata = { title: 'ログイン ｜ School Insight AI' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  // next はクエリから入ってくる。そのまま router.replace に渡すと
  // ログイン成功後に外部サイトへ飛ばせてしまう。
  return (
    <SignInForm authEnabled={isAuthEnabled()} next={safeNextPath(next)} linkError={error} />
  );
}
