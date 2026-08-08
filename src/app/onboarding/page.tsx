import { redirect } from 'next/navigation';

import { OnboardingForm } from '@/components/auth/OnboardingForm';
import { getCurrentSession, isAuthEnabled } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const metadata = { title: '学校の登録 ｜ School Insight AI' };

/**
 * 初回の学校登録。学校法人名と自校を登録し、登録した人が管理者になる。
 * 比較校の追加は登録後に 08 で行う。最初に5校まとめて入力させると、
 * 途中で止まったときに何も残らない。
 */
export default async function OnboardingPage() {
  if (!isAuthEnabled()) redirect('/');

  const session = await getCurrentSession();
  if (!session) redirect('/signin');
  if (session.membership) redirect('/schools');

  return <OnboardingForm email={session.user.email} />;
}
