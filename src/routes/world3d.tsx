import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { farmAction, getFarm } from '@/server/farm.functions'

export const Route = createFileRoute('/world3d')({ component: World3DPreview })

type V3 = [number, number, number]
type Thing = { p: V3; s: V3; c: V3; kind?: 'person' | 'tree' }

const vertex = `attribute vec3 aPosition;
attribute vec3 aColor;
uniform mat4 uMvp;
varying vec3 vColor;
void main(){ gl_Position=uMvp*vec4(aPosition,1.0); vColor=aColor; }`
const fragment = `precision mediump float;
varying vec3 vColor;
void main(){ gl_FragColor=vec4(vColor,1.0); }`

function perspective(fov:number, aspect:number, near:number, far:number) {
  const f=1/Math.tan(fov/2), nf=1/(near-far)
  return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0])
}
function multiply(a:Float32Array,b:Float32Array) {
  const o=new Float32Array(16)
  for(let c=0;c<4;c++) for(let r=0;r<4;r++) o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3]
  return o
}
function view(eye:V3,target:V3) {
  const norm=(v:V3):V3=>{const l=Math.hypot(...v)||1;return [v[0]/l,v[1]/l,v[2]/l]}
  const sub=(a:V3,b:V3):V3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]]
  const cross=(a:V3,b:V3):V3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
  const z=norm(sub(eye,target)), x=norm(cross([0,1,0],z)), y=cross(z,x)
  return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-(x[0]*eye[0]+x[1]*eye[1]+x[2]*eye[2]),-(y[0]*eye[0]+y[1]*eye[1]+y[2]*eye[2]),-(z[0]*eye[0]+z[1]*eye[1]+z[2]*eye[2]),1])
}
function World3DPreview(){
  const canvas=useRef<HTMLCanvasElement>(null)
  const [error,setError]=useState('')
  const [showFarm,setShowFarm]=useState(false)
  const [showMarket,setShowMarket]=useState(false)
  const [farm,setFarm]=useState<Awaited<ReturnType<typeof getFarm>> | null>(null)
  const [farmBusy,setFarmBusy]=useState(false)
  const [farmError,setFarmError]=useState('')
  const [farmNow,setFarmNow]=useState(Date.now())
  const [interaction,setInteraction]=useState('Explore the village. Walk to the cassava plots and press E to open the Farm District.')
  const hint='Use the movement pad · Drag the world to look around'
  useEffect(()=>{if(!showFarm&&!showMarket)return;let active=true;void getFarm().then(v=>{if(active)setFarm(v)}).catch(e=>{if(active)setFarmError(e instanceof Error?e.message:'Farm could not load.')});const clock=window.setInterval(()=>setFarmNow(Date.now()),1000);return()=>{active=false;window.clearInterval(clock)}},[showFarm,showMarket])
  const actFarm=async(action:'plant'|'water'|'harvest'|'process',plotId?:string)=>{if(farmBusy)return;setFarmBusy(true);setFarmError('');try{setFarm(await farmAction({data:{action,plotId}}))}catch(e){setFarmError(e instanceof Error?e.message:'Farm action failed.')}finally{setFarmBusy(false)}}
  useEffect(()=>{
    const el=canvas.current, gl=el?.getContext('webgl',{antialias:true})
    if(!el||!gl){setError('This browser could not start WebGL. Try Chrome with hardware acceleration enabled.');return}
    const compile=(type:number,src:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'Shader error');return s}
    try{
      const program=gl.createProgram()!;gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program)
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'3D renderer link failed')
      gl.useProgram(program)
      const vertices:number[]=[],colors:number[]=[]
      const cube=(p:V3,s:V3,c:V3,targetVertices=vertices,targetColors=colors)=>{
        const [x,y,z]=p,[w,h,d]=s, faces=[
          [[0,0,1],[0,0,1],[1,0,1],[1,1,1],[0,1,1]],
          [[0,0,0],[1,0,0],[1,0,1],[1,1,1],[1,1,0]],
          [[1,0,0],[0,0,0],[0,0,1],[0,1,1],[0,1,0]],
          [[0,1,0],[0,1,1],[1,1,1],[1,1,0],[0,1,0]],
          [[0,0,0],[0,0,1],[1,0,1],[1,0,0],[0,0,0]],
          [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,0]]
        ]
        const tris=[[0,1,2,0,2,3]]
        for(let f=0;f<faces.length;f++){const a=faces[f];for(const i of tris[0]){const q=a[i];targetVertices.push(x+q[0]*w,y+q[1]*h,z+q[2]*d);const light=[.82,1,.78,.92,.68,.74][f];targetColors.push(c[0]*light,c[1]*light,c[2]*light)}}
      }
      const things:Thing[]=[
        {p:[0,-.12,0],s:[70,.2,70],c:[.22,.42,.2]},
        {p:[-1,-.01,0],s:[2,.12,70],c:[.34,.31,.25]},
        {p:[0,-.01,-1],s:[70,.12,2],c:[.34,.31,.25]},
        {p:[-11,0,-10],s:[8,4,7],c:[.76,.57,.35]},
        {p:[-12,4,-11],s:[10,2,9],c:[.42,.19,.14]},
        {p:[8,0,-13],s:[9,5,8],c:[.78,.68,.48]},
        {p:[7,5,-14],s:[11,2,10],c:[.3,.2,.16]},
        {p:[13,0,8],s:[8,3.5,7],c:[.72,.5,.31]},
        {p:[12,3.5,7],s:[10,1.8,9],c:[.4,.18,.14]},
        {p:[-15,0,12],s:[7,4,7],c:[.73,.64,.47]},
        {p:[-16,4,11],s:[9,1.7,9],c:[.36,.2,.14]},
      ]
      // Cassava beds, processing shed and market stalls.
      for(let r=0;r<3;r++)for(let c=0;c<4;c++){
        const x=8+c*2.2,z=12+r*2.1
        things.push({p:[x,0,z],s:[1.9,.18,1.7],c:[.34,.19,.1]})
        things.push({p:[x+.7,.18,z+.65],s:[.45,.7,.45],c:[.2,.52,.19]})
      }
      things.push({p:[-18,0,-2],s:[7,3,6],c:[.48,.3,.17]})
      things.push({p:[-19,3,-3],s:[9,1.4,8],c:[.3,.19,.13]})
      // Palm trunks and canopies.
      for(const [x,z] of [[-20,-17],[19,-18],[21,15],[-20,19],[2,-22]] as number[][]){
        things.push({p:[x,0,z],s:[.55,4,.55],c:[.38,.22,.11]})
        things.push({p:[x-1.8,3.7,z-1.8],s:[3.6,1.1,3.6],c:[.13,.38,.16]})
      }
      // NPCs are rendered dynamically below so their walking/work animations update every frame.
      for(const t of things)cube(t.p,t.s,t.c)
      const vb=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW)
      const pos=gl.getAttribLocation(program,'aPosition'), col=gl.getAttribLocation(program,'aColor')
      // Positions and colors are separate tightly-packed buffers; an interleaved stride skips vertices.
      gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,0,0)
      const cb=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,cb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(colors),gl.STATIC_DRAW)
      gl.enableVertexAttribArray(col);gl.vertexAttribPointer(col,3,gl.FLOAT,false,0,0)
      const mvp=gl.getUniformLocation(program,'uMvp')
      const npcPositionBuffer=gl.createBuffer()!,npcColorBuffer=gl.createBuffer()!
      const npcRoutes=[
        {a:[-3,-5],b:[3,-4],phase:0,color:[.78,.22,.12] as V3,role:'farmer'},
        {a:[-7,5],b:[-12,1],phase:1.3,color:[.12,.48,.42] as V3,role:'resident'},
        {a:[5,8],b:[11,10],phase:2.2,color:[.75,.58,.22] as V3,role:'trader'},
        {a:[15,3],b:[10,13],phase:3.1,color:[.3,.34,.72] as V3,role:'water carrier'},
        {a:[-14,-1],b:[-8,-7],phase:4.4,color:[.58,.28,.62] as V3,role:'processor'},
        {a:[2,-16],b:[-3,-10],phase:5.2,color:[.72,.72,.62] as V3,role:'resident'}
      ]
      let px=0,pz=13,yaw=0,drag=false,lastX=0,lastY=0,frame=0,lastFrame=0
      const keys=new Set<string>()
      const buildings=[{x:-11,z:-10,rx:5.2,rz:4.7},{x:8,z:-13,rx:5.7,rz:5.2},{x:13,z:8,rx:5.1,rz:4.7},{x:-15,z:12,rx:4.6,rz:4.5},{x:-18,z:-2,rx:4.7,rz:4.2}]
      const farmPoint={x:11,z:15}
      const blocked=(x:number,z:number)=>buildings.some(b=>Math.abs(x-b.x)<b.rx&&Math.abs(z-b.z)<b.rz)
      const down=(e:KeyboardEvent)=>{
        const key=e.key.toLowerCase()
        if(key==='e'){
          const farmDistance=Math.hypot(px-farmPoint.x,pz-farmPoint.z)
          const marketDistance=Math.hypot(px-13,pz-8)
          const millDistance=Math.hypot(px+18,pz+2)
          if(farmDistance<5){setInteraction('Farm District opened. Manage your cassava plots here.');setShowFarm(true);return}
          if(marketDistance<6){setInteraction('Market Square opened. Check your stored harvest and market status.');setShowMarket(true)}
          else if(millDistance<6){setInteraction('Processing Shed opened. Turn your harvested cassava into garri.');setShowFarm(true)}
          else setInteraction('Move closer to the cassava plots, market or processing shed to interact.')
        }
        keys.add(key)
      }
      const up=(e:KeyboardEvent)=>keys.delete(e.key.toLowerCase())
      const start=(e:PointerEvent)=>{drag=true;lastX=e.clientX;lastY=e.clientY;el.setPointerCapture(e.pointerId)}
      const move=(e:PointerEvent)=>{if(drag){yaw+=(e.clientX-lastX)*.008;lastX=e.clientX;lastY=e.clientY}}
      const end=()=>drag=false
      window.addEventListener('keydown',down);window.addEventListener('keyup',up)
      el.addEventListener('pointerdown',start);el.addEventListener('pointermove',move);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end)
      const draw=(now:number)=>{
        const dt=Math.min(.04,lastFrame?((now-lastFrame)/1000):.016);lastFrame=now
        const w=el.clientWidth,h=el.clientHeight,dpr=Math.min(devicePixelRatio||1,1.5)
        if(el.width!==Math.round(w*dpr)||el.height!==Math.round(h*dpr)){el.width=Math.round(w*dpr);el.height=Math.round(h*dpr)}
        gl.viewport(0,0,el.width,el.height);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clearColor(.48,.69,.83,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT)
        const step=5.2*dt
        let dx=0,dz=0
        if(keys.has('w')||keys.has('arrowup')){dx+=Math.sin(yaw)*step;dz-=Math.cos(yaw)*step}
        if(keys.has('s')||keys.has('arrowdown')){dx-=Math.sin(yaw)*step;dz+=Math.cos(yaw)*step}
        if(keys.has('a')||keys.has('arrowleft')){dx-=Math.cos(yaw)*step;dz-=Math.sin(yaw)*step}
        if(keys.has('d')||keys.has('arrowright')){dx+=Math.cos(yaw)*step;dz+=Math.sin(yaw)*step}
        const nextX=Math.max(-27,Math.min(27,px+dx)),nextZ=Math.max(-27,Math.min(27,pz+dz))
        if(!blocked(nextX,pz))px=nextX
        if(!blocked(px,nextZ))pz=nextZ
        const eye:[number,number,number]=[px-Math.sin(yaw)*8,5.5,pz+Math.cos(yaw)*8]
        const target:[number,number,number]=[px,1.1,pz]
        gl.uniformMatrix4fv(mvp,false,multiply(perspective(Math.PI/3,el.width/Math.max(1,el.height),.1,120),view(eye,target)))
        // Restore the static scene buffers before drawing the world each frame.
        gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,0,0)
        gl.bindBuffer(gl.ARRAY_BUFFER,cb);gl.vertexAttribPointer(col,3,gl.FLOAT,false,0,0)
        gl.drawArrays(gl.TRIANGLES,0,vertices.length/3)

        // Procedural village residents: walk between work points, swing arms/legs, and bob while moving.
        const npcVertices:number[]=[],npcColors:number[]=[]
        const t=now/1000
        for(const npc of npcRoutes){
          const wave=(Math.sin(t*.32+npc.phase)+1)/2
          const x=npc.a[0]+(npc.b[0]-npc.a[0])*wave
          const z=npc.a[1]+(npc.b[1]-npc.a[1])*wave
          const moving=Math.cos(t*.32+npc.phase)
          const stride=Math.sin(t*4+npc.phase)*.22*moving
          const bob=Math.abs(Math.sin(t*4+npc.phase))*.045*Math.abs(moving)
          const skin:[number,number,number]=[.38,.22,.14]
          cube([x-.23,.72+bob,z-.15],[.46,.66,.3],npc.color,npcVertices,npcColors)
          cube([x-.18,1.4+bob,z-.14],[.36,.36,.28],skin,npcVertices,npcColors)
          cube([x-.31,.78+bob+stride,z-.12],[.13,.55,.14],[.16,.17,.2],npcVertices,npcColors)
          cube([x+.18,.78+bob-stride,z-.12],[.13,.55,.14],[.16,.17,.2],npcVertices,npcColors)
          cube([x-.43,.82+bob-stride,z-.1],[.12,.5,.13],npc.color,npcVertices,npcColors)
          cube([x+.31,.82+bob+stride,z-.1],[.12,.5,.13],npc.color,npcVertices,npcColors)
        }
        gl.bindBuffer(gl.ARRAY_BUFFER,npcPositionBuffer)
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(npcVertices),gl.DYNAMIC_DRAW)
        gl.vertexAttribPointer(pos,3,gl.FLOAT,false,0,0)
        gl.bindBuffer(gl.ARRAY_BUFFER,npcColorBuffer)
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(npcColors),gl.DYNAMIC_DRAW)
        gl.vertexAttribPointer(col,3,gl.FLOAT,false,0,0)
        gl.drawArrays(gl.TRIANGLES,0,npcVertices.length/3)
        frame=requestAnimationFrame(draw)
      }
      frame=requestAnimationFrame(draw)
      return ()=>{cancelAnimationFrame(frame);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);el.removeEventListener('pointerdown',start);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',end);el.removeEventListener('pointercancel',end);gl.deleteBuffer(vb);gl.deleteBuffer(cb);gl.deleteBuffer(npcPositionBuffer);gl.deleteBuffer(npcColorBuffer);gl.deleteProgram(program)}
    }catch(e){setError(e instanceof Error?e.message:'3D scene could not start')}
  },[])
  return <main className="fixed inset-0 overflow-hidden bg-[#16251d] text-white">
    <canvas ref={canvas} className="h-full w-full touch-none" aria-label="GARRIVERSE 3D village preview"/>
    <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-white/20 bg-black/55 px-4 py-3 backdrop-blur">
      <div className="text-xs font-black tracking-[.24em] text-amber-300">GARRIVERSE 2026</div>
      <div className="mt-1 text-lg font-bold">Living Town · 3D prototype</div>
      <div className="text-xs text-white/70">{hint} · Press E to interact</div>
    </div>
    <a href="/" className="absolute right-4 top-4 rounded-xl bg-black/60 px-4 py-3 text-sm font-semibold">← Back to town</a>
    {showMarket&&<div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-3"><section className="w-full max-w-lg rounded-2xl border border-amber-300/30 bg-[#17251d] p-4 text-white"><div className="flex items-start justify-between"><div><div className="text-xs font-black tracking-widest text-amber-300">GARRIVERSE MARKET SQUARE</div><h2 className="text-xl font-black">Harvest inventory</h2></div><button onClick={()=>setShowMarket(false)}>Close ✕</button></div>{farm?<><div className="mt-4 grid grid-cols-3 gap-2 text-center">{[["Cassava",farm.cassava],["Garri",farm.garri],["Stems",farm.seeds]].map(([label,value])=><div key={String(label)} className="rounded-xl bg-white/10 p-3"><b className="text-xl text-amber-300">{value}</b><div className="text-xs">{label}</div></div>)}</div><p className="mt-4 text-sm text-white/75">Your harvest is saved in your farm ledger. Market trading and $GARRI payouts are not enabled yet, so no sale or wallet transaction will be simulated here.</p></>:<p className="py-6 text-center text-sm text-white/70">Open the Market again in a moment while your inventory loads.</p>}<button onClick={()=>{setShowMarket(false);setShowFarm(true)}} className="mt-4 w-full rounded-lg bg-amber-400 p-3 text-sm font-bold text-black">Manage farm and process garri</button></section></div>}
    {showFarm&&<div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-3"><section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-amber-300/30 bg-[#17251d] p-4 text-white"><div className="flex justify-between"><div><div className="text-xs font-black tracking-widest text-amber-300">GARRIVERSE FARM DISTRICT</div><h2 className="text-xl font-black">Cassava fields</h2></div><button onClick={()=>setShowFarm(false)}>Close ✕</button></div>
    {farm?<><div className="mt-3 grid grid-cols-3 gap-2 text-center">{[['Stems',farm.seeds],['Cassava',farm.cassava],['Garri',farm.garri]].map(([label,value])=><div key={String(label)} className="rounded-xl bg-white/10 p-3"><b className="text-xl text-amber-300">{value}</b><div className="text-xs">{label}</div></div>)}</div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">{farm.plots.map((plot,index)=>{const remaining=plot.readyAt?Math.max(0,Date.parse(plot.readyAt)-farmNow):0;const ready=plot.state==='growing'&&remaining===0;return <div key={plot.id} className="rounded-xl border border-white/10 p-3"><div className="flex justify-between text-sm"><b>Plot {index+1}</b><span>{plot.state==='empty'?'Empty':ready?'Ready':Math.ceil(remaining/60000)+'m left'}</span></div><div className="my-2 text-center text-3xl">{plot.state==='empty'?'🟫':ready?'🌾':plot.wateredAt?'🌱💧':'🌱'}</div>{plot.state==='empty'?<button disabled={farmBusy||farm.seeds<1} onClick={()=>void actFarm('plant',plot.id)} className="w-full rounded-lg bg-amber-400 p-2 text-sm font-bold text-black disabled:opacity-40">Plant cassava</button>:<div className="grid grid-cols-2 gap-2">{!plot.wateredAt&&!ready&&<button disabled={farmBusy} onClick={()=>void actFarm('water',plot.id)} className="rounded-lg bg-white/10 p-2 text-xs">Water</button>}<button disabled={farmBusy||!ready} onClick={()=>void actFarm('harvest',plot.id)} className="rounded-lg bg-amber-400 p-2 text-xs font-bold text-black disabled:opacity-40">Harvest</button></div>}</div>})}</div>
    <div className="mt-3 flex items-center justify-between rounded-xl bg-white/10 p-3"><div><b>Processing shed</b><div className="text-xs">3 cassava → 1 garri</div></div><button disabled={farmBusy||farm.cassava<3} onClick={()=>void actFarm('process')} className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-bold text-black disabled:opacity-40">Process garri</button></div></>:<div className="py-8 text-center">Loading farm ledger…</div>}
    {farmError&&<div role="alert" className="mt-3 rounded-lg bg-red-950 p-3 text-sm">{farmError}</div>}<p className="mt-3 text-center text-xs text-white/50">Server-saved in-game resources. No token or cash payouts.</p></section></div>}
    <div className="absolute bottom-5 left-5 grid grid-cols-3 gap-2 select-none">
      <span />
      <button aria-label="Move forward" className="h-14 w-14 touch-none rounded-2xl border-2 border-white/40 bg-black/80 text-2xl font-bold active:bg-amber-400 active:text-black" onContextMenu={e=>e.preventDefault()} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);window.dispatchEvent(new KeyboardEvent("keydown",{key:"w"}))}} onPointerUp={e=>{e.preventDefault();window.dispatchEvent(new KeyboardEvent("keyup",{key:"w"}))}} onPointerCancel={()=>window.dispatchEvent(new KeyboardEvent("keyup",{key:"w"}))} onLostPointerCapture={()=>window.dispatchEvent(new KeyboardEvent("keyup",{key:"w"}))}>↑</button>
      <span />
      {(["a","s","d"] as const).map(k=><button key={k} aria-label={k==="a"?"Move left":k==="s"?"Move backward":"Move right"} className="h-14 w-14 touch-none rounded-2xl border-2 border-white/40 bg-black/80 text-2xl font-bold active:bg-amber-400 active:text-black" onContextMenu={e=>e.preventDefault()} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);window.dispatchEvent(new KeyboardEvent("keydown",{key:k}))}} onPointerUp={e=>{e.preventDefault();window.dispatchEvent(new KeyboardEvent("keyup",{key:k}))}} onPointerCancel={()=>window.dispatchEvent(new KeyboardEvent("keyup",{key:k}))} onLostPointerCapture={()=>window.dispatchEvent(new KeyboardEvent("keyup",{key:k}))}>{k==="a"?"←":k==="s"?"↓":"→"}</button>)}
    </div>
    <div className="absolute bottom-5 right-5 flex max-w-[min(55vw,22rem)] flex-col items-end gap-2">
      <div className="rounded-xl border border-white/15 bg-black/75 px-3 py-3 text-xs text-white/90 backdrop-blur">
        <div className="mb-1 font-bold text-amber-300">WORLD GUIDE</div>
        <div>{interaction}</div>
        <div className="mt-2 text-white/55">Drag to look · Press E or tap INTERACT</div>
      </div>
      <button className="rounded-xl border border-amber-300/50 bg-amber-400 px-5 py-3 text-sm font-black text-black shadow-lg" onClick={()=>window.dispatchEvent(new KeyboardEvent("keydown",{key:"e"}))}>INTERACT · E</button>
    </div>
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-4 py-2 text-xs text-white/80">WASD / Arrow keys · Drag to look</div>
    {error&&<div role="alert" className="absolute bottom-20 left-4 right-4 rounded-xl bg-red-950/90 p-3 text-sm">{error}</div>}
  </main>
}
