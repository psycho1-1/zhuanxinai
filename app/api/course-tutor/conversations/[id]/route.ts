import { handleCourse } from '@/server/course-tutor/http';
type Context = { params: Promise<{ id: string }> };
export const GET = async (request: Request, c: Context) =>
  handleCourse(request, 'conversation', (await c.params).id);
export const DELETE = async (request: Request, c: Context) =>
  handleCourse(request, 'conversation', (await c.params).id);
