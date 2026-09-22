// Zero-credit, deterministic content drafts. No network, provider SDK, or publishing side effects.
// These curated Scripture references are supplied as study pointers, not automated theological certification.
const BLUEPRINTS = [
  {
    id: 'trust', match: /\b(trust|trusting|uncertain|uncertainty|guidance|direction|faith|way forward)\b/i,
    title: 'When You Cannot See the Next Step',
    hook: "You do not have to see the whole road to take the next faithful step.",
    scripture: 'Proverbs 3:5–6', support: ['Psalm 37:5', 'Isaiah 41:10'],
    context: "Proverbs 3 is wisdom instruction about relying on the Lord rather than treating our own understanding as sufficient. It is not a guarantee of an easy life or a precise timetable.",
    truth: 'Trust can be practiced in uncertainty through prayer, wise counsel, and the next responsible step.',
    caution: 'Do not promise that trusting God removes hardship or reveals every future outcome.',
    reflection: "When the way ahead is unclear, the temptation is to demand the whole map before taking one step. Proverbs 3:5–6 invites us to depend on the Lord instead of making our own limited understanding the final authority. It does not say that questions disappear. It calls for trust in the middle of them.\n\nYou can bring your uncertainty to God honestly. Ask for wisdom, listen carefully, seek wise counsel, and take the faithful step that is in front of you. Psalm 37:5 also speaks about committing our way to the Lord. Isaiah 41:10 first addressed God's people in their need; its language of God's presence reminds us why Scripture returns again and again to courage and dependence on Him.\n\nFollowing Jesus does not require pretending that you know what tomorrow holds. It means choosing prayer over panic, integrity over shortcuts, and obedience over fear today. If you feel overwhelmed, begin with one simple prayer. Then do the next good thing you can see. Your unknown future is not a reason to stop seeking God in the present.",
    script: "Can't see the way forward? Proverbs 3:5–6 calls us to trust in the Lord rather than lean only on our own understanding. That is not a promise that everything will be easy. It is an invitation to keep walking faithfully when the whole road is hidden. Pray honestly. Ask for wisdom. Speak to someone trustworthy. Do the next right thing. Your faith does not have to pretend that uncertainty is easy. You can bring your real questions to Jesus and keep following Him one step at a time.",
    lines: ['WHEN THE ROAD IS UNCLEAR', 'PROVERBS 3:5–6', 'PRAY. SEEK WISDOM.', 'TAKE THE NEXT FAITHFUL STEP']
  },
  {
    id:'prayer', match:/\b(pray|prayer|praying|ask god)\b/i,
    title:'Bring It to God in Prayer',
    hook:'Your next prayer does not need polished words.',
    scripture:'Philippians 4:6–7',support:['Matthew 6:9–13','1 Thessalonians 5:17'],
    context:'Philippians encourages believers to bring requests to God with thanksgiving amid real pressures. The passage does not promise every requested result.',
    truth:'Prayer turns our attention to God while we continue to act responsibly.',
    caution:'Never suggest that people who remain anxious have failed to pray correctly.',
    reflection:'You do not need a perfect sentence before you speak with God. Philippians 4:6–7 urges believers to bring their requests to Him with thanksgiving. The words were given to a community facing genuine difficulty, not to people for whom everything was already comfortable.\n\nJesus also taught His disciples to pray in Matthew 6. Prayer includes worship, dependence, forgiveness, and concern for daily needs. It is much more than a wish list. If you feel tired or unsure, begin with what is true: tell God what is weighing on you. Ask for wisdom to take the next responsible step. Bring thanks for the help you have already received.\n\nPrayer is not a guarantee that every circumstance will change on demand. It is a way of returning to the God who hears us. Make space to listen, to seek counsel where needed, and to care for others. One honest prayer today can be the beginning of a faithful rhythm tomorrow.',
    script:'Feeling overwhelmed? You do not need polished words to pray. Philippians 4:6–7 encourages believers to bring real requests to God with thanksgiving. Jesus taught His disciples to pray for daily needs, forgiveness, and God’s will. Tell Him what is on your heart. Thank Him for what you can. Ask for wisdom, then take the next responsible step. Prayer is not a formula for controlling tomorrow. It is a way to turn toward God today.',
    lines:['YOU CAN PRAY HONESTLY','PHILIPPIANS 4:6–7','BRING YOUR REQUESTS','KEEP WALKING IN FAITH']
  },
  {
    id:'fear',match:/\b(fear|afraid|scared|anxious|anxiety|worry|worried)\b/i,
    title:'Faith in the Middle of Fear',
    hook:'Courage can begin while you are still afraid.',
    scripture:'Psalm 56:3',support:['Isaiah 41:10','2 Timothy 1:7'],
    context:'Psalm 56 speaks from a setting of real threat. Its trust language does not deny the existence of fear.',
    truth:'Bringing fear to God and seeking appropriate support can go together.',
    caution:'Do not blame people for anxiety or promise instant relief.',
    reflection:'Fear can make the next step feel bigger than you are. Psalm 56:3 expresses trust precisely at a time of fear. It does not pretend that danger or worry is imaginary. It gives us words for turning toward God while we are still unsettled.\n\nIf you feel afraid, start by naming what is happening. Pray plainly. Ask for wisdom. Speak with someone safe and trustworthy; practical help and spiritual care do not compete. Isaiah 41:10 addressed God’s people with reassurance during distress, and 2 Timothy 1:7 calls attention to courage, love, and self-control in Christian service.\n\nCourage does not always look dramatic. It might look like asking for help, making one wise decision, or choosing not to isolate yourself. Keep your eyes on Jesus without pretending the struggle is easy. You can grow in faith through small, steady acts of trust today.',
    script:'Feeling afraid? Psalm 56:3 gives us words for trusting God when fear is real. Faith is not pretending that nothing hurts. Pray honestly. Ask for wisdom. Speak to someone you trust. Take one safe, responsible step. You can look to Jesus and accept practical support at the same time. Courage can start small.',
    lines:['FEAR IS REAL','PSALM 56:3','BRING IT TO GOD','ONE COURAGEOUS STEP']
  },
  {
    id:'strength',match:/\b(strength|strong|weak|overcome|victory|endure|tired)\b/i,
    title:'Strength for Today',
    hook:'Strength in Christ is not a promise of an easy day.',
    scripture:'Philippians 4:13',support:['Philippians 4:11–12','2 Corinthians 12:9'],
    context:'Paul speaks about endurance and contentment in both need and plenty. The verse is not a promise of unlimited achievement.',
    truth:'Christ sustains faithfulness even during hardship.',
    caution:'Do not use Philippians 4:13 to guarantee personal success or deny exhaustion.',
    reflection:'There are days when you feel you have reached the edge of your strength. Philippians 4:13 is often quoted as a promise that we can achieve anything, but Paul is speaking about contentment and endurance through very different circumstances. Christ gives him strength to remain faithful in plenty and in need.\n\nThat truth matters when you do not feel impressive. You can ask Jesus to sustain you without pretending you are never tired. You can receive help, rest, and encouragement from other believers. In 2 Corinthians 12:9, Paul also speaks of God’s grace in weakness.\n\nYou do not need to prove your worth by carrying everything alone. Take the next responsible step, seek support, and keep your heart open to God. Today’s strength may look like patience, humility, prayer, or courage to begin again. Following Jesus is not about appearing invincible; it is about depending on Him faithfully.',
    script:'Philippians 4:13 is not a guarantee that everything will go your way. Paul is talking about learning to endure both need and plenty through Christ. If you are tired, you can ask for help. If you are struggling, you can rest and pray. Christ’s strength is not a demand to look unstoppable. It is an invitation to depend on Him in real life, today.',
    lines:['STRENGTH FOR TODAY','PHILIPPIANS 4:13','GRACE IN WEAKNESS','KEEP FOLLOWING JESUS']
  },
  {
    id:'hope',match:/\b(hope|hopeless|waiting|wait|discouraged|future)\b/i,
    title:'Hope That Holds On',
    hook:'Hope can be quiet and still be real.',
    scripture:'Romans 15:13',support:['Lamentations 3:21–23','Romans 8:24–25'],
    context:'Romans 15 speaks of shared hope and peace in believing. Lamentations voices grief before recalling God’s mercies.',
    truth:'Biblical hope rests in God, not in predicting how each event will unfold.',
    caution:'Do not promise quick resolution or say suffering should be ignored.',
    reflection:'Sometimes hope is not loud. Sometimes it is the simple decision to pray again when you feel worn down. Romans 15:13 speaks of joy, peace, and hope in God. In Lamentations 3, hope is recalled in the middle of grief, not after grief has been neatly erased.\n\nYou can be honest about what hurts and still turn toward Jesus. Ask for wisdom for today. Receive care from people you trust. Let Scripture remind you that your present feelings do not have to provide the final word about your life.\n\nHope does not mean inventing a date when everything will improve. It means keeping your attention on God’s character while making faithful choices in the present. Whether today brings an answer or another waiting day, keep praying, keep loving, and keep asking for the help you need. Small steps can still be steps of faith.',
    script:'What if hope is quieter than you expected? Romans 15:13 points us toward hope in God. Lamentations remembers His mercies in the middle of grief. You do not have to hide your disappointment to follow Jesus. Pray honestly, receive support, and take one faithful step today. Hope does not require knowing the whole ending.',
    lines:['HOPE FOR TODAY','ROMANS 15:13','BE HONEST WITH GOD','TAKE ONE FAITHFUL STEP']
  },
  {
    id:'forgiveness',match:/\b(forgiv|mercy|grace|reconciliation)\b/i,
    title:'Learning to Forgive',
    hook:'Forgiveness can be a process, not a performance.',
    scripture:'Ephesians 4:32',support:['Colossians 3:13','Matthew 6:14–15'],
    context:'Paul calls the church to kindness and forgiveness grounded in God’s forgiveness in Christ.',
    truth:'Forgiveness matters in Christian life; wise boundaries and safety still matter.',
    caution:'Do not require an unsafe reunion, minimize harm, or pressure victims to remain in danger.',
    reflection:'Forgiveness can be difficult, especially when pain is real. Ephesians 4:32 calls Christians to kindness and forgiveness in light of God’s grace in Christ. That instruction is not permission to minimize harm or force an unsafe relationship.\n\nStart honestly. Tell God what happened and what you need. Seek wise pastoral and practical support where appropriate. You can desire healing while maintaining needed boundaries. Colossians 3:13 also points believers toward patience with one another; it does not erase accountability.\n\nFollowing Jesus can mean taking one truthful step toward releasing revenge without pretending trust has already been restored. Do not rush yourself into appearances. Pray for a heart shaped by mercy, ask for help where the situation is serious, and let care for people include care for safety. Grace and truth belong together.',
    script:'Forgiveness is not pretending that harm did not happen. Ephesians 4:32 calls us toward forgiveness because of God’s grace in Christ. You can seek healing and keep wise boundaries. You can pray honestly and ask trustworthy people for help. Grace never requires pretending that safety does not matter. Take the next truthful step with Jesus.',
    lines:['GRACE AND TRUTH','EPHESIANS 4:32','BOUNDARIES CAN MATTER','ASK GOD FOR WISDOM']
  },
  {
    id:'gospel',match:/\b(jesus|salvation|gospel|cross|saviour|savior|christ|saved)\b/i,
    title:'The Good News of Jesus',
    hook:'The Gospel begins with what God has done, not what you can earn.',
    scripture:'Ephesians 2:8–10',support:['John 3:16','Romans 5:8'],
    context:'Ephesians describes salvation by grace through faith and connects new life with good works as a result, not a purchase price.',
    truth:'Christian hope centers on Jesus and God’s grace.',
    caution:'Do not reduce salvation to follower counts, engagement, or a formula for success.',
    reflection:'The good news of Jesus is not that you must become impressive enough for God to notice you. Ephesians 2:8–10 teaches salvation by grace through faith, and it speaks about good works as the life that follows God’s gift. They are not the price of admission.\n\nJohn 3:16 points to God’s love, and Romans 5:8 points to Christ’s love shown toward sinners. This is why the Christian message begins with Jesus rather than with our social media achievements or polished appearances.\n\nIf you are exploring faith, read the Gospels and ask honest questions. If you already follow Christ, let gratitude become kindness, prayer, and faithful service. You cannot measure a soul by clicks or likes. You can share the Gospel clearly, treat people with dignity, and trust God with what you cannot control. One sincere conversation may matter more than impressive numbers.',
    script:'The Gospel is not about becoming impressive enough for God. Ephesians 2:8–10 teaches that salvation is by grace through faith, with good works as a response to God’s gift. John 3:16 points us to God’s love. Look to Jesus, read the Gospels, and bring your honest questions. Faith is more than a social media metric.',
    lines:['THE GOOD NEWS','EPHESIANS 2:8–10','GRACE THROUGH FAITH','LOOK TO JESUS']
  }
]
const limit=(s,n)=>typeof s==='string' ? s.trim().slice(0,n) : ''
export function buildZeroCreditCampaign(input) {
  if(!input || typeof input!=='object' || Array.isArray(input)) return {error:'A valid message brief is required.',statusCode:400}
  const topic=limit(input.topic,300),audience=limit(input.audience,500),goal=limit(input.goal,500),tone=limit(input.tone,200)
  const channels=Array.isArray(input.channels)?input.channels.filter(s=>typeof s==='string'&&s.trim()).slice(0,9):[]
  if(topic.length<3||audience.length<3||goal.length<3||tone.length<2||channels.length<1||channels.length>8)
    return {error:'Complete the topic, audience, goal, tone and at least one channel.',statusCode:400}
  const item=BLUEPRINTS.find(x=>x.match.test(topic))
  if(!item)return {error:'No curated, offline Scripture template matches that topic. Choose a topic involving trust, prayer, fear, strength, hope, forgiveness, or the Gospel. This zero-credit mode will not invent Bible research.',statusCode:422}
  const tags=['#OneMillionSouls','#Jesus','#ChristianTikTok','#Bible','#Faith','#'+item.id.charAt(0).toUpperCase()+item.id.slice(1)]
  const caption=item.hook+' '+item.scripture+' — Study the passage in context and share a thoughtful response.'
  const cta='What is one faithful step you can take today?'
  const scene='Cinematic, modern Christian visual storytelling: open Bible in natural light, a simple cross, quiet landscape, legible Scripture reference. No borrowed sermon clips, unsafe symbolism, or unlicensed assets.'
  const imagePrompts=[
    '9:16 natural-light close-up of an open Bible on a simple table, with ample empty space for a clearly legible '+item.scripture+' reference; avoid legible fabricated Bible text.',
    '9:16 cinematic outdoor path at sunrise with coherent shot progression and mobile-safe caption area; no unrelated religious imagery.',
    '9:16 simple wooden cross against a gentle blue-gold sky; no stock watermark and no text baked into the image.'
  ]
  const campaign={
    title:item.title,hook:item.hook,devotional:item.reflection,tiktokScript:item.script,
    onScreenText:item.lines,caption,hashtags:tags,cta,visualConcept:scene,imagePrompts,
    bible:{primaryScripture:item.scripture,supportingScriptures:item.support,context:item.context,keyTruth:item.truth,cautions:[item.caution]},
    quality:{
      scriptureAccurate:false,biblicalConsistency:false,gospelCentered:false,audienceFit:false,retentionReady:false,
      notes:[
        'ZERO-CREDIT LOCAL TEMPLATE DRAFT: no AI provider was called. These checkboxes remain pending, not failed.',
        'Read each referenced passage in context; confirm theology, originality, and suitability before use.',
        'Target audience: '+audience+'. Ministry goal: '+goal+'. Tone requested: '+tone+'.',
        'Visual prompts are directions only. No images, voice, MP4, social post, or publication was generated.',
        'Publishing remains locked; this is not a certified final master.'
      ],status:'REVISE'
    },
    status:'DRAFT_REVIEW_REQUIRED',zeroCredit:true,provider:'local-curated-template',publishingLocked:true,
    growthStrategy:null,experiments:[],platformPackages:null,platformValidation:{valid:false,issues:['Manual platform and source review required']}
  }
  return {campaign}
}
