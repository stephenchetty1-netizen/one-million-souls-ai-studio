import './server.mjs'
import './schedule-loop.mjs'
import './daily-factory.mjs'
import './free-ai-probe.mjs'
import './free-ai-smoke.mjs'
import './free-ai-sample-v3.mjs'

import { stagePexelsCollection } from './pexels-source-import.mjs'

// Explicitly enabled one-shot source import. Keep the HTTP service healthy
// while the external video download runs; neither staging nor errors authorize
// publishing. Each source is cached in private persistent storage.
const requestedPexelsCollection=String(process.env.PEXELS_AUTOSTAGE_COLLECTION||'').trim()
if(requestedPexelsCollection){
  console.log('PEXELS_AUTOSTAGE_REQUESTED',JSON.stringify({
    collection:requestedPexelsCollection,publishingLocked:true
  }))
  void stagePexelsCollection(requestedPexelsCollection)
    .then(result=>console.log('PEXELS_AUTOSTAGE_RESULT',JSON.stringify(result)))
    .catch(error=>console.error('PEXELS_AUTOSTAGE_FAILED',JSON.stringify({
      collection:requestedPexelsCollection,
      error:error instanceof Error?error.message:String(error),
      publishingLocked:true
    })))
}
