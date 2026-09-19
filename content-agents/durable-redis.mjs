import net from 'node:net'
import tls from 'node:tls'

function encodeCommand(values){
  const args=values.map((value)=>Buffer.from(String(value)))
  const chunks=[Buffer.from(`*${args.length}\r\n`)]
  for(const arg of args)chunks.push(Buffer.from(`$${arg.length}\r\n`),arg,Buffer.from('\r\n'))
  return Buffer.concat(chunks)
}

function parseResp(buffer,offset=0){
  if(offset>=buffer.length)return null
  const type=String.fromCharCode(buffer[offset])
  const lineEnd=buffer.indexOf('\r\n',offset+1)
  if(lineEnd<0)return null
  const line=buffer.subarray(offset+1,lineEnd).toString('utf8')
  if(type==='+')return {value:line,next:lineEnd+2}
  if(type==='-')throw new Error(`REDIS_ERROR:${line}`)
  if(type===':')return {value:Number(line),next:lineEnd+2}
  if(type==='$'){
    const size=Number(line)
    if(size===-1)return {value:null,next:lineEnd+2}
    const start=lineEnd+2,end=start+size
    if(buffer.length<end+2)return null
    return {value:buffer.subarray(start,end).toString('utf8'),next:end+2}
  }
  if(type==='*'){
    const count=Number(line)
    if(count===-1)return {value:null,next:lineEnd+2}
    let next=lineEnd+2
    const values=[]
    for(let i=0;i<count;i++){
      const parsed=parseResp(buffer,next)
      if(!parsed)return null
      values.push(parsed.value)
      next=parsed.next
    }
    return {value:values,next}
  }
  throw new Error(`REDIS_PROTOCOL_UNKNOWN_TYPE:${type}`)
}

function parseRedisUrl(raw){
  const url=new URL(raw)
  if(!['redis:','rediss:'].includes(url.protocol))throw new Error('REDIS_URL_PROTOCOL_UNSUPPORTED')
  const dbPath=url.pathname.replace(/^\//,'')
  const db=dbPath?Number(dbPath):0
  if(!Number.isInteger(db)||db<0)throw new Error('REDIS_URL_INVALID_DATABASE')
  return {
    tls:url.protocol==='rediss:',
    host:url.hostname,
    port:Number(url.port||6379),
    username:decodeURIComponent(url.username||''),
    password:decodeURIComponent(url.password||''),
    db,
  }
}

async function socketCommand(command){
  const raw=String(process.env.REDIS_URL||'').trim()
  if(!raw)throw new Error('REDIS_URL_NOT_CONFIGURED')
  const config=parseRedisUrl(raw)
  const commands=[]
  if(config.password)commands.push(['AUTH',config.username||'default',config.password])
  if(config.db)commands.push(['SELECT',String(config.db)])
  commands.push(command.map((value)=>String(value)))

  return await new Promise((resolve,reject)=>{
    let settled=false
    let buffer=Buffer.alloc(0)
    let parsedCount=0
    const responses=[]
    const finish=(error,value)=>{
      if(settled)return
      settled=true
      clearTimeout(timer)
      socket.destroy()
      if(error)reject(error);else resolve(value)
    }
    const options={host:config.host,port:config.port}
    const socket=config.tls
      ? tls.connect({...options,servername:config.host,rejectUnauthorized:process.env.REDIS_TLS_REJECT_UNAUTHORIZED!=='false'})
      : net.createConnection(options)
    const timer=setTimeout(()=>finish(new Error('REDIS_SOCKET_TIMEOUT')),10000)
    socket.setNoDelay(true)
    socket.on('error',(error)=>finish(error))
    socket.on('data',(chunk)=>{
      buffer=Buffer.concat([buffer,chunk])
      try{
        let offset=0
        while(parsedCount<commands.length){
          const parsed=parseResp(buffer,offset)
          if(!parsed)break
          responses.push(parsed.value)
          parsedCount++
          offset=parsed.next
        }
        if(offset>0)buffer=buffer.subarray(offset)
        if(parsedCount===commands.length){
          for(let i=0;i<commands.length-1;i++){
            if(responses[i]!=='OK')return finish(new Error(`REDIS_SETUP_FAILED:${String(responses[i])}`))
          }
          finish(null,responses[responses.length-1])
        }
      }catch(error){
        finish(error instanceof Error?error:new Error(String(error)))
      }
    })
    const readyEvent=config.tls?'secureConnect':'connect'
    socket.once(readyEvent,()=>{
      try{
        socket.write(Buffer.concat(commands.map(encodeCommand)))
      }catch(error){
        finish(error instanceof Error?error:new Error(String(error)))
      }
    })
  })
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
  if(process.env.REDIS_URL)return socketCommand(command)
  return restCommand(command)
}
