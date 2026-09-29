import AccountGate from '@/components/server-account-gate';
import CourseCatalog from '@/components/course-catalog';
import '../studio.css';
export default function Courses() {
  return (
    <AccountGate>
      <CourseCatalog />
    </AccountGate>
  );
}
