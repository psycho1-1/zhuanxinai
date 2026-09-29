import { handle } from '@/server/evidence/http';
export const GET = (request:Request) => handle(request,'status');
