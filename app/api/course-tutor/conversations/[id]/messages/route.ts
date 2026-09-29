import { handleCourse } from '@/server/course-tutor/http';
export const POST = async (
  request: Request,
  c: { params: Promise<{ id: string }> },
) => handleCourse(request, 'messages', (await c.params).id);
