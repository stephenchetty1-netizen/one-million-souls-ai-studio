import test from 'node:test'
import assert from 'node:assert/strict'
import {classifyFactoryManifestFailure} from './factory-manifest-errors.mjs'

test('missing dated factory manifest is not a server outage or green output',()=>{
 const r=classifyFactoryManifestFailure(Object.assign(new Error('The specified key does not exist'),{name:'NoSuchKey'}),{date:'2026-09-26',key:'manifests/2026-09-26.json'});
 assert.equal(r.status,404);
 assert.equal(r.body.error,'FACTORY_MANIFEST_NOT_GENERATED');
 assert.equal(r.body.publishingAllowed,false);
 assert.equal(r.body.releaseReady,false);
});
test('storage errors produce 503, never a deceptive 404',()=>{
 const r=classifyFactoryManifestFailure(Object.assign(new Error('Access Denied'),{name:'AccessDenied',$metadata:{httpStatusCode:403}}),{date:'latest',key:'manifests/latest.json'});
 assert.equal(r.status,503);
 assert.equal(r.body.error,'FACTORY_MANIFEST_STORAGE_READ_FAILED');
 assert.equal(r.body.publishingAllowed,false);
});
test('unconfigured storage produces 503, not manifest missing',()=>{
 const r=classifyFactoryManifestFailure(new Error('Persistent storage unavailable'),{storageConfigured:false});
 assert.equal(r.status,503);
 assert.equal(r.body.error,'FACTORY_MANIFEST_STORAGE_UNAVAILABLE');
});
