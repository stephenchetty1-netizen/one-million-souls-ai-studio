import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const C={bg:'#050a13',panel:'#0b1728',blue:'#2c8cff',gold:'#f4c34e',white:'#f8fbff',silver:'#bcc8d8',dim:'#6f7f95'};
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'};

function Grid({frame}){
  return <AbsoluteFill style={{
    opacity:.2,
    backgroundImage:'linear-gradient(rgba(255,255,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.07) 1px,transparent 1px)',
    backgroundSize:'80px 80px',
    backgroundPosition:`0 ${frame%80}px`,
    maskImage:'linear-gradient(to bottom,transparent 0%,black 18%,black 78%,transparent 100%)'
  }}/>;
}

function PremiumBackdrop({frame,mode}){
  const drift=Math.sin(frame/38)*42;
  const sweep=(frame*5)%1500-250;
  const pulse=.55+.18*Math.sin(frame/24);
  const accent=mode==='scripture'||mode==='cta'?C.gold:C.blue;
  return <AbsoluteFill style={{overflow:'hidden',background:'#03070d'}}>
    <AbsoluteFill style={{
      background:'radial-gradient(circle at 78% 16%, rgba(44,140,255,.32), transparent 31%), radial-gradient(circle at 15% 84%, rgba(244,195,78,.14), transparent 28%), linear-gradient(155deg,#02050a 0%,#071526 46%,#03070e 100%)'
    }}/>
    <div style={{
      position:'absolute',left:-220+drift,top:-180,width:920,height:920,borderRadius:'50%',
      background:'radial-gradient(circle, rgba(44,140,255,.20) 0%, rgba(44,140,255,.08) 34%, transparent 68%)',
      filter:'blur(18px)',transform:`scale(${1+pulse*.05})`
    }}/>
    <div style={{
      position:'absolute',right:-270-drift,top:520,width:880,height:880,borderRadius:'50%',
      background:'radial-gradient(circle, rgba(244,195,78,.15) 0%, rgba(244,195,78,.04) 36%, transparent 70%)',
      filter:'blur(24px)'
    }}/>
    <div style={{
      position:'absolute',left:sweep,top:-300,width:170,height:2450,
      transform:'rotate(18deg)',background:`linear-gradient(to right, transparent, ${accent}22, transparent)`,
      filter:'blur(18px)',opacity:.8
    }}/>
    <div style={{
      position:'absolute',inset:-220,
      backgroundImage:'repeating-radial-gradient(circle at 40% 40%, rgba(255,255,255,.035) 0 1px, transparent 1px 6px)',
      opacity:.16,transform:`translate3d(${drift*.35}px,${-drift*.18}px,0) scale(1.08)`
    }}/>
    <div style={{
      position:'absolute',left:70,right:70,top:170,height:1,
      background:'linear-gradient(90deg,transparent,rgba(255,255,255,.18),transparent)',
      boxShadow:'0 0 34px rgba(44,140,255,.25)'
    }}/>
    <AbsoluteFill style={{
      background:'linear-gradient(to bottom,rgba(255,255,255,.015),transparent 23%,transparent 72%,rgba(0,0,0,.44))',
      boxShadow:'inset 0 0 220px rgba(0,0,0,.72)'
    }}/>
  </AbsoluteFill>;
}

function Particles({frame}){
  return <AbsoluteFill>{Array.from({length:18}).map((_,i)=>{
    const x=(i*173+91)%1000;
    const y=((i*229+41)+frame*(.45+(i%5)*.11))%1900;
    const s=4+(i%4)*2;
    return <div key={i} style={{
      position:'absolute',left:x,top:y,width:s,height:s,
      borderRadius:i%3===0?0:99,
      transform:`rotate(${frame*(.35+i*.02)}deg)`,
      background:i%4===0?C.gold:'rgba(44,140,255,.75)',
      opacity:.22+(i%5)*.09
    }}/>;
  })}</AbsoluteFill>;
}

function BaseTitle({scene,frame,durationInFrames}){
  const {fps}=useVideoConfig();
  const enter=spring({fps,frame,config:{damping:17,stiffness:120,mass:.8}});
  const y=interpolate(enter,[0,1],[90,0],clamp);
  const opacity=interpolate(frame,[0,8,Math.max(9,durationInFrames-10),durationInFrames-1],[0,1,1,0],clamp);
  return <div style={{opacity,transform:`translateY(${y}px)`}}>
    <div style={{fontFamily:'Lato,Arial,sans-serif',fontSize:88,lineHeight:.98,fontWeight:900,letterSpacing:-3,textTransform:'uppercase',color:C.white,textShadow:'0 14px 48px rgba(0,0,0,.45)'}}>{scene.title}</div>
    <div style={{marginTop:26,maxWidth:850,fontFamily:'Lato,Arial,sans-serif',fontSize:38,lineHeight:1.25,fontWeight:700,color:C.silver}}>{scene.body}</div>
  </div>;
}

function SceneVisual({scene,durationInFrames}){
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const pop=spring({fps,frame,config:{damping:14,stiffness:145,mass:.75}});
  const scale=interpolate(pop,[0,1],[1.8,1],clamp);
  const slide=interpolate(pop,[0,1],[420,0],clamp);
  const scan=interpolate(frame,[0,durationInFrames],[0,850],clamp);

  let special=null;
  if(scene.mode==='impact') special=<>
    {[0,1,2].map(i=><div key={i} style={{position:'absolute',right:-90-i*55,top:245-i*30,width:390+i*155,height:390+i*155,borderRadius:'50%',border:`${i?2:5}px dashed rgba(244,195,78,${.5-i*.1})`,transform:`rotate(${frame*(.25+i*.1)}deg)`}}/>)}
    <div style={{position:'absolute',left:70,right:70,top:390,transform:`scale(${scale})`,transformOrigin:'left center'}}>
      <BaseTitle scene={scene} frame={frame} durationInFrames={durationInFrames}/>
      <div style={{marginTop:30,color:C.gold,fontFamily:'Lato',fontWeight:900,fontSize:42}}>{scene.accent}</div>
    </div>
  </>;

  if(scene.mode==='contrast') special=<div style={{position:'absolute',left:70,right:70,top:320}}>
    <BaseTitle scene={scene} frame={frame} durationInFrames={durationInFrames}/>
    <div style={{display:'flex',gap:22,marginTop:60}}>
      {[scene.left,scene.right].map((text,i)=><div key={text} style={{flex:1,minHeight:220,padding:28,borderRadius:28,border:`2px solid ${i?'rgba(244,195,78,.62)':'rgba(255,255,255,.14)'}`,background:i?'rgba(244,195,78,.08)':'rgba(255,255,255,.04)',color:i?C.gold:C.silver,fontFamily:'Lato',fontSize:31,fontWeight:900,textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',transform:`translateX(${i?-slide:slide}px)`}}>{text}</div>)}
    </div>
  </div>;

  if(scene.mode==='scripture') special=<div style={{position:'absolute',left:70,right:70,top:330,padding:'66px 54px',border:'2px solid rgba(44,140,255,.55)',background:'linear-gradient(155deg,rgba(11,23,40,.95),rgba(5,10,19,.82))',clipPath:'polygon(0 0,92% 0,100% 7%,100% 100%,8% 100%,0 93%)',overflow:'hidden'}}>
    <div style={{position:'absolute',left:scan,top:0,bottom:0,width:3,background:C.gold,boxShadow:'0 0 24px rgba(244,195,78,.7)'}}/>
    <div style={{fontFamily:'monospace',color:C.blue,fontWeight:800,fontSize:28,letterSpacing:4}}>{scene.reference}</div>
    <div style={{marginTop:34}}><BaseTitle scene={scene} frame={frame} durationInFrames={durationInFrames}/></div>
  </div>;

  if(scene.mode==='cards') special=<div style={{position:'absolute',left:70,right:70,top:300}}>
    <BaseTitle scene={scene} frame={frame} durationInFrames={durationInFrames}/>
    <div style={{display:'grid',gap:18,marginTop:55}}>
      {(scene.cards||[]).map((card,i)=>{
        const e=spring({fps,frame:Math.max(0,frame-12*i),config:{damping:17,stiffness:130}});
        return <div key={card} style={{transform:`translateX(${interpolate(e,[0,1],[430,0],clamp)}px)`,padding:'26px 30px',borderRadius:22,background:i===1?'rgba(244,195,78,.10)':'rgba(44,140,255,.09)',border:`1px solid ${i===1?'rgba(244,195,78,.5)':'rgba(44,140,255,.4)'}`,color:i===1?C.gold:C.white,fontSize:38,fontWeight:900,letterSpacing:3,fontFamily:'Lato'}}>0{i+1} · {card}</div>;
      })}
    </div>
  </div>;

  if(scene.mode==='signal') special=<div style={{position:'absolute',left:70,right:70,top:300}}>
    <BaseTitle scene={scene} frame={frame} durationInFrames={durationInFrames}/>
    <div style={{position:'relative',marginTop:55,padding:'40px 34px',borderRadius:26,border:'1px solid rgba(255,255,255,.12)',background:'rgba(255,255,255,.035)',overflow:'hidden'}}>
      <div style={{position:'absolute',left:0,right:0,top:scan,height:2,background:C.gold,boxShadow:'0 0 26px rgba(244,195,78,.7)'}}/>
      <div style={{display:'flex',flexWrap:'wrap',gap:14}}>{(scene.chips||[]).map((chip,i)=><div key={chip} style={{padding:'18px 22px',borderRadius:999,background:i%2?'rgba(244,195,78,.11)':'rgba(44,140,255,.11)',border:'1px solid rgba(255,255,255,.16)',color:i%2?C.gold:C.white,fontSize:28,fontWeight:900,fontFamily:'Lato'}}>{chip}</div>)}</div>
    </div>
  </div>;

  if(scene.mode==='steps') special=<div style={{position:'absolute',left:70,right:70,top:290}}>
    <BaseTitle scene={scene} frame={frame} durationInFrames={durationInFrames}/>
    <div style={{display:'grid',gap:18,marginTop:50}}>{(scene.steps||[]).map((step,i)=>{
      const e=spring({fps,frame:Math.max(0,frame-i*13),config:{damping:16,stiffness:125}});
      return <div key={step} style={{display:'flex',alignItems:'center',gap:20,opacity:e,transform:`translateY(${interpolate(e,[0,1],[45,0],clamp)}px)`}}>
        <div style={{width:72,height:72,borderRadius:22,background:C.gold,color:C.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,fontWeight:900,fontFamily:'Lato'}}>{i+1}</div>
        <div style={{flex:1,padding:'24px 26px',borderRadius:22,border:'1px solid rgba(255,255,255,.12)',background:C.panel,color:C.white,fontSize:32,fontWeight:900,fontFamily:'Lato'}}>{step}</div>
      </div>;
    })}</div>
  </div>;

  if(scene.mode==='network'){
    const cx=540,cy=1090;
    special=<><div style={{position:'absolute',left:70,right:70,top:300}}><BaseTitle scene={scene} frame={frame} durationInFrames={durationInFrames}/></div>
      {Array.from({length:8}).map((_,i)=>{
        const a=Math.PI*2*i/8+frame*.006;
        const r=220+(i%2)*70;
        const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;
        return <div key={i}>
          <div style={{position:'absolute',left:cx,top:cy,width:r,height:2,transformOrigin:'left center',transform:`rotate(${a*180/Math.PI}deg)`,background:'rgba(44,140,255,.18)'}}/>
          <div style={{position:'absolute',left:x-16,top:y-16,width:32,height:32,borderRadius:99,background:i%3===0?C.gold:C.blue,boxShadow:'0 0 30px rgba(44,140,255,.35)'}}/>
        </div>;
      })}
      <div style={{position:'absolute',left:466,top:1016,width:148,height:148,borderRadius:99,background:C.gold,color:C.bg,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Lato',fontWeight:900,fontSize:26}}>SHINE</div>
    </>;
  }

  if(scene.mode==='cta') special=<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',textAlign:'center',padding:70}}>
    <div style={{transform:`scale(${interpolate(pop,[0,1],[.45,1],clamp)})`}}>
      <div style={{fontFamily:'Lato',fontSize:28,fontWeight:900,letterSpacing:7,color:C.gold}}>{scene.kicker}</div>
      <div style={{marginTop:26,fontFamily:'Lato',fontSize:104,lineHeight:.92,fontWeight:900,letterSpacing:-4,color:C.white}}>{scene.title}</div>
      <div style={{marginTop:32,fontFamily:'Lato',fontSize:34,fontWeight:900,color:C.silver}}>{scene.body}</div>
      <div style={{marginTop:42,display:'inline-block',padding:'18px 28px',borderRadius:999,background:C.gold,color:C.bg,fontFamily:'monospace',fontSize:28,fontWeight:900}}>{scene.accent}</div>
    </div>
  </div>;

  return <AbsoluteFill style={{background:C.bg,overflow:'hidden'}}>
    <PremiumBackdrop frame={frame} mode={scene.mode}/>
    <Grid frame={frame}/><Particles frame={frame}/>
    <div style={{position:'absolute',left:70,right:70,top:116,zIndex:10,fontFamily:'Lato',fontSize:26,fontWeight:900,letterSpacing:6,color:C.gold}}>{scene.kicker}</div>
    {special}
    <div style={{position:'absolute',left:70,right:70,bottom:88,display:'flex',justifyContent:'space-between',color:C.dim,fontFamily:'Lato',fontSize:22,fontWeight:900,letterSpacing:2}}><span>ONE MILLION SOULS</span><span>JESUS • HOPE • FAITH</span></div>
  </AbsoluteFill>;
}

function CaptionTrack({captions=[]}){
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const now=frame/fps*1000;
  const active=captions.findIndex(c=>now>=Number(c.startMs)&&now<Number(c.endMs));
  if(active<0)return null;
  const start=Math.max(0,active-1);
  return <div style={{position:'absolute',left:80,right:80,bottom:205,zIndex:50,display:'flex',flexWrap:'wrap',justifyContent:'center',gap:'8px 13px'}}>
    {captions.slice(start,start+4).map((c,o)=>{
      const on=start+o===active;
      return <span key={c.startMs+'-'+o} style={{fontFamily:'Lato',fontSize:on?56:49,lineHeight:1,fontWeight:900,color:on?C.gold:C.white,textTransform:'uppercase',textShadow:'0 8px 26px rgba(0,0,0,.9)',transform:on?'scale(1.06)':'scale(1)'}}>{String(c.text||'').trim()}</span>;
    })}
  </div>;
}

export const YoutubeSinglePromptShort=(props)=>{
  const {fps}=useVideoConfig();
  return <AbsoluteFill style={{backgroundColor:C.bg}}>
    {(props.scenes||[]).map(scene=>{
      const from=Math.round(Number(scene.start)*fps);
      const durationInFrames=Math.max(1,Math.round((Number(scene.end)-Number(scene.start))*fps));
      return <Sequence key={scene.id} from={from} durationInFrames={durationInFrames} premountFor={Math.min(15,durationInFrames)}>
        <SceneVisual scene={scene} durationInFrames={durationInFrames}/>
      </Sequence>;
    })}
    {props.audioUrl?<Audio src={props.audioUrl} volume={.82}/>:null}
    <CaptionTrack captions={props.captions}/>
  </AbsoluteFill>;
};
