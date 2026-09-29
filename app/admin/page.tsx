import AccountGate from '@/components/server-account-gate';
import CourseStudio from '@/components/course-studio';
import '../studio.css';
export default function Admin() {
  return (
    <AccountGate>
      <CourseStudio />
    </AccountGate>
  );
}
