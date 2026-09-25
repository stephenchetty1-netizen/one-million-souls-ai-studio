// Classify manifest lookup errors without converting storage failures into false "missing" results.
export function classifyFactoryManifestFailure(error,{date,key,storageConfigured=true}={}){
 const code=String(error?.name||error?.Code||'');
 const message=String(error?.message||error||'');
 const http=Number(error?.$metadata?.httpStatusCode||0);
 const missing=['NoSuchKey','NotFound','NoSuchObject'].includes(code)||http===404||/specified key does not exist/i.test(message);
 const details={ok:false,date,key,releaseReady:false,publishingAllowed:false};
 if(!storageConfigured)return {status:503,body:{...details,error:'FACTORY_MANIFEST_STORAGE_UNAVAILABLE'}};
 if(missing)return {status:404,body:{...details,error:'FACTORY_MANIFEST_NOT_GENERATED'}};
 return {status:503,body:{...details,error:'FACTORY_MANIFEST_STORAGE_READ_FAILED',storageErrorCode:code||'UNKNOWN'}};
}
