import assert from 'node:assert/strict';
import { requestModel, callModel } from '../lib/ai/providers';
async function main(){
 const original=globalThis.fetch;
 const vars=['GROQ_API_KEY','GROQ_API_KEY_2','GEMINI_API_KEY','GEMINI_API_KEY_2','AI_PRIMARY_PROVIDER'] as const;
 const saved=Object.fromEntries(vars.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{GROQ_API_KEY:'test',GROQ_API_KEY_2:'test2',GEMINI_API_KEY:'test',AI_PRIMARY_PROVIDER:'groq'});delete process.env.GEMINI_API_KEY_2;
 try {
  const calls:string[]=[];
  globalThis.fetch=(async(input)=>{calls.push(String(input));return String(input).includes('groq')?new Response('',{status:503}):Response.json({choices:[{message:{content:'ok'}}]});}) as typeof fetch;
  const r=await callModel([{role:'user',content:'hello'}],[]);
  assert.equal(r.provider,'gemini');assert.equal(calls.length,2);assert.ok(calls[0].includes('groq'));
  let count=0; const signals:unknown[]=[];
  globalThis.fetch=(async(_input,init)=>{signals.push(init?.signal);count++;return count===1?new Response('',{status:401}):Response.json({choices:[{message:{content:'ok'}}]});}) as typeof fetch;
  await requestModel({provider:'groq',model:'test'},[],[]);assert.equal(count,2);assert.equal(signals[0],signals[1]);
  const abort=new AbortController();count=0;
  globalThis.fetch=(async()=>{count++;abort.abort();throw new Error('aborted')}) as typeof fetch;
  await assert.rejects(()=>callModel([],[],abort.signal),/cancelled/);assert.equal(count,1);
  console.log('PASS fast provider order, immediate server-error fallback, credential failover with shared deadline, cancellation without fallback.');
 }finally{globalThis.fetch=original;for(const k of vars){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
}
main().catch(e=>{console.error(e);process.exitCode=1});
