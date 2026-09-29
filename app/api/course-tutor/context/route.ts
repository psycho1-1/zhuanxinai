import { handleCourse } from '@/server/course-tutor/http';
export const GET = (request: Request) => handleCourse(request, 'context');
