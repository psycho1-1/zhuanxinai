import { handle } from '@/server/evidence/http';
export const POST = (request:Request) => handle(request,'tutor');
