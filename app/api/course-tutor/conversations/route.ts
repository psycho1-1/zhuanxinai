import { handleCourse } from '@/server/course-tutor/http';
export const GET = (request: Request) => handleCourse(request, 'conversations');
export const POST = (request: Request) =>
  handleCourse(request, 'conversations');
