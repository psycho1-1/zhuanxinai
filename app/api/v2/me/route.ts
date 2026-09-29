import { handle } from '@/server/evidence/http';
export const DELETE = (request:Request) => handle(request,'me');
