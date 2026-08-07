import { SignInForm } from '@/components/auth/SignInForm';
import { isAuthEnabled } from '@/lib/auth/session';

export const metadata = { title: 'ログイン ｜ School Insight AI' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <SignInForm authEnabled={isAuthEnabled()} next={next ?? '/'} />;
}
