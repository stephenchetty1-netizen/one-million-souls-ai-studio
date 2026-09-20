// Original Christian editorial treatments. Neither a stock search result nor a
// technically valid montage qualifies as a Christian ministry master.
// No copyrighted song lyrics or Bible passage text reproduced here.
const SHORT_SCRIPT = [
'Have you ever wondered whether God still welcomes you after everything you have carried?',
'Here is the good news of Jesus Christ: grace is not a prize for perfect people.',
'John chapter one, verse sixteen points us to grace upon grace, received from Christ.',
'That means you can stop hiding behind a brave face and bring your real heart to God.',
'Open the Bible. Talk to Jesus. Tell Him what hurts, what you regret, and what you hope for.',
'His mercy invites us to repent, trust Him, and begin again.',
'You do not need a perfect speech. Start with one honest prayer.',
'Jesus, thank You for loving us. Lead us closer to You today. Amen.',
'One million souls. One mission. One Saviour. Share this hope with someone who needs it.'
].join(' ');
const LONG_SCRIPT = [
'What comes to mind when you hear the words amazing grace? For some, it is a familiar hymn. For others, it is the hope that God has not given up on them. Today, I want to tell you why the grace of Jesus Christ matters in an ordinary, complicated life.',
'Maybe you woke up carrying an unanswered prayer. Maybe you have regrets you do not know how to explain. Maybe your faith feels smaller than it did last year. None of those experiences is a reason to pretend. God invites us to come honestly before Him.',
'John chapter one, verse sixteen speaks of receiving grace upon grace from Christ. That is not a promise that every day will be easy. It is the invitation to receive what we could never earn through our own perfection. We come to Jesus because we need Him, not because we already have everything together.',
'Ephesians chapter two, verses eight and nine reminds believers that salvation is by grace through faith, not something we can boast about. We do not manufacture our own rescue by collecting enough good days. We respond to the mercy God has shown us in Jesus Christ.',
'Think about the person who feels too ashamed to pray. The person who has disappointed people they love. The person who quietly believes their story is already over. If that is you, hear this: you can turn toward Jesus today. You can confess honestly, ask for forgiveness, and take a new step of obedience.',
'Grace does not mean our choices no longer matter. Because Christ loves us, we can face what needs to change without living in denial. We can apologize, seek help, make things right where possible, and learn to walk in truth. His grace invites transformation rather than pretending there is no wound.',
'Psalm forty-six, verse ten calls us to be still and know that He is God. When life gets noisy, stillness may begin with setting your phone down for one minute. Open Scripture. Take your fear to the Lord. Ask Him for wisdom, not merely a quick escape from every difficult responsibility.',
'If you are waiting on an answer, let prayer become a place of honesty. Tell Jesus what you need. Keep making wise choices. Let trusted Christian friends pray with you. Faith is not refusing practical help. It is walking with God through real circumstances.',
'And remember that grace is not only for you to hold. It changes how you meet the next person. Encourage someone who feels invisible. Forgive where you can. Offer compassion instead of a careless judgment. Let people see the character of Jesus in your words and actions.',
'At One Million Souls, the invitation is simple: one conversation, one prayer, one person at a time. We are not chasing a number at the cost of a soul. We want people to encounter Jesus Christ and discover the hope of the gospel.',
'So wherever you are watching from, begin with this prayer. Lord Jesus, thank You for Your mercy. Forgive us, renew our hearts, and teach us to follow You. Give us courage to live faithfully, kindness to love others, and wisdom for the next step. Let our lives point people toward You.',
'If this message reached you at the right moment, share it with someone you care about. Open your Bible, find a church community rooted in Christ, and keep walking with Him. Amazing grace is not the end of the story. In Jesus, it is the beginning of a new life. Amen.'
].join(' ');
const SHORT_CARDS=[
 'GRACE FOR THE WEARY','JESUS WELCOMES YOU','JOHN 1:16','GRACE UPON GRACE',
 'COME AS YOU ARE','OPEN THE BIBLE','BEGIN WITH PRAYER','JESUS BRINGS HOPE',
 'ONE MISSION • ONE SAVIOUR'
];
const LONG_CARDS=[
 'AMAZING GRACE','HOPE FOR AN ORDINARY LIFE','BRING YOUR REAL HEART',
 'JOHN 1:16','GRACE UPON GRACE','RECEIVE, NOT EARN','EPHESIANS 2:8–9',
 'SALVATION BY GRACE','YOU CAN TURN TO JESUS','HONEST REPENTANCE',
 'GRACE BRINGS CHANGE','TAKE THE NEXT STEP','BE STILL','PSALM 46:10',
 'OPEN SCRIPTURE','PRAY HONESTLY','SEEK WISE SUPPORT','LET GRACE OVERFLOW',
 'ENCOURAGE SOMEONE','ONE SOUL AT A TIME','JESUS CHRIST IS OUR HOPE',
 'LORD, RENEW OUR HEARTS','WALK WITH JESUS','ONE MISSION • ONE SAVIOUR'
];
export const CHRISTIAN_STORY_PLANS=Object.freeze({
 SHORT_59:Object.freeze({format:'SHORT_59',reference:'John 1:16',title:'Amazing Grace | Hope in Jesus',
  voiceScript:SHORT_SCRIPT,cards:Object.freeze(SHORT_CARDS),voiceMinSeconds:35,
  voiceMaxSeconds:57,musicGainDb:-23,publishingAllowed:false}),
 YOUTUBE_LONG:Object.freeze({format:'YOUTUBE_LONG',reference:'John 1:16; Ephesians 2:8–9; Psalm 46:10',
  title:'Amazing Grace | Finding Hope in Jesus',voiceScript:LONG_SCRIPT,
  cards:Object.freeze(LONG_CARDS),voiceMinSeconds:145,voiceMaxSeconds:237,
  musicGainDb:-24,publishingAllowed:false}),
})
export function requireChristianStoryPlan(format){
 const plan=CHRISTIAN_STORY_PLANS[format]
 if(!plan)throw Error('CHRISTIAN_STORY_PLAN_REQUIRED')
 if(plan.cards.length!==(format==='SHORT_59'?9:24))throw Error('CHRISTIAN_STORY_CARD_COUNT_INVALID')
 if(!plan.voiceScript.includes('Jesus')||!plan.voiceScript.includes('grace')||
    !plan.voiceScript.includes('prayer')||
    !plan.voiceScript.includes('John chapter one'))
  throw Error('CHRISTIAN_STORY_MESSAGE_INCOMPLETE')
 return plan
}
export function requireNarratedChristianMasterEvidence(asset){
 if(!asset||!CHRISTIAN_STORY_PLANS[asset.profileId]||
    asset.voiceover!==true||asset.onScreenWords!==true||
    asset.musicUnderNarration!==true||asset.voiceSeconds<CHRISTIAN_STORY_PLANS[asset.profileId].voiceMinSeconds||
    asset.voiceSeconds>CHRISTIAN_STORY_PLANS[asset.profileId].voiceMaxSeconds||
    asset.textCardCount!==CHRISTIAN_STORY_PLANS[asset.profileId].cards.length||
    asset.editorialStatus!=='AWAITING_FULL_AUDIOVISUAL_AND_RIGHTS_REVIEW')
   throw Error('SILENT_OR_UNAPPEALING_CHRISTIAN_MONTAGE_REJECTED')
 return true
}
