import LearningApp from '@/components/learning-app';
import './studio.css';
import CourseCatalog from '@/components/course-catalog';
import AccountGate from '@/components/server-account-gate';
import { accountsEnabled } from '@/server/account';
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string; course?: string }>;
}) {
  const params = await searchParams;
  const content = params.course === 'legacy' || params.lesson ? (
    <LearningApp
      initialLessonId={
        typeof params.lesson === 'string' ? params.lesson : undefined
      }
    />
  ) : <CourseCatalog />;
  return accountsEnabled() ? <AccountGate>{content}</AccountGate> : content;
}
