import test from 'node:test';
import assert from 'node:assert/strict';
import {timedFetch} from '../lib/timed-fetch.ts';
test('登录请求和响应正文停滞时都能超时退出',async()=>{
  const original=globalThis.fetch;
  try {
    for(const stalledBody of [false,true]) {
      globalThis.fetch=async(_url,{signal})=>{
        const stall=new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));
        return stalledBody?{ok:true,status:200,text:()=>stall}:stall;
      };
      await assert.rejects(timedFetch('/api/auth/session',{},15),/连接超时/);
    }
  } finally {globalThis.fetch=original;}
});
