import { createClient } from 'redis'

let clientPromise=null

async function directClient(){
  if(clientPromise)return clientPromise
  const url=String(process.env.REDIS_URL||'').trim()
  if(!url)throw new Error('REDIS_URL_NOT_CONFIGURED')
  clientPromise=(async()=>{
    const client=createClient({url})
    client.on('error',(error)=>console.error('DURABLE_REDIS_CLIENT_ERROR',error?.message||String(error)))
    await client.connect()
    return client
  })().catch((error)=>{clientPromise=null;throw error})
  return clientPromise
}

async function restCommand(command){
  const url=String(process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL||'').replace(/\/$/,'')
  const token=String(process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN||'')
  if(!url||!token)throw new Error('REDIS_REST_NOT_CONFIGURED')
  const response=await fetch(url,{
    method:'POST',
    headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
    body:JSON.stringify(command),
    cache:'no-store',
  })
  if(!response.ok)throw new Error(`REDIS_REST_HTTP_${response.status}`)
  const data=await response.json()
  if(data?.error)throw new Error(`REDIS_REST_ERROR:${data.error}`)
  return data?.result
}

export async function durableRedis(command){
  if(!Array.isArray(command)||!command.length)throw new Error('REDIS_COMMAND_REQUIRED')
  if(process.env.REDIS_URL){
    const client=await directClient()
    return client.sendCommand(command.map((value)=>String(value)))
  }
  return restCommand(command)
}
