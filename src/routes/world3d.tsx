import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

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
  const [interaction,setInteraction]=useState('Explore the village. Walk to the cassava plots and press E to open the Farm District.')
  const hint='Drag to look around · WASD to move'
  useEffect(()=>{
    const el=canvas.current, gl=el?.getContext('webgl',{antialias:true})
    if(!el||!gl){setError('This browser could not start WebGL. Try Chrome with hardware acceleration enabled.');return}
    const compile=(type:number,src:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'Shader error');return s}
    try{
      const program=gl.createProgram()!;gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program)
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'3D renderer link failed')
      gl.useProgram(program)
      const vertices:number[]=[],colors:number[]=[]
      const cube=(p:V3,s:V3,c:V3)=>{
        const [x,y,z]=p,[w,h,d]=s, faces=[
          [[0,0,1],[0,0,1],[1,0,1],[1,1,1],[0,1,1]],
          [[0,0,0],[1,0,0],[1,0,1],[1,1,1],[1,1,0]],
          [[1,0,0],[0,0,0],[0,0,1],[0,1,1],[0,1,0]],
          [[0,1,0],[0,1,1],[1,1,1],[1,1,0],[0,1,0]],
          [[0,0,0],[0,0,1],[1,0,1],[1,0,0],[0,0,0]],
          [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,0]]
        ]
        const tris=[[0,1,2,0,2,3]]
        for(let f=0;f<faces.length;f++){const a=faces[f];for(const i of tris[0]){const q=a[i];vertices.push(x+q[0]*w,y+q[1]*h,z+q[2]*d);const light=[.82,1,.78,.92,.68,.74][f];colors.push(c[0]*light,c[1]*light,c[2]*light)}}
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
      // Stylised resident figures placed around the plaza and work areas.
      const people:[number,number,number][]=[[-3,0,-5],[3,0,-4],[-7,0,5],[5,0,8],[15,0,3],[-14,0,-1]]
      for(const [x,y,z] of people){
        things.push({p:[x-.22,y,z-.18],s:[.44,1.05,.36],c:[.75,.25,.12]})
        things.push({p:[x-.19,y+1.05,z-.16],s:[.38,.38,.34],c:[.35,.2,.12]})
        things.push({p:[x-.28,y-.85,z-.12],s:[.2,.85,.22],c:[.12,.13,.18]})
        things.push({p:[x+.08,y-.85,z-.12],s:[.2,.85,.22],c:[.12,.13,.18]})
      }
      for(const t of things)cube(t.p,t.s,t.c)
      const vb=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW)
      const stride=6*4, pos=gl.getAttribLocation(program,'aPosition'), col=gl.getAttribLocation(program,'aColor')
      gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,stride,0)
      const cb=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,cb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(colors),gl.STATIC_DRAW)
      gl.enableVertexAttribArray(col);gl.vertexAttribPointer(col,3,gl.FLOAT,false,0,0)
      const mvp=gl.getUniformLocation(program,'uMvp')
      let px=0,pz=13,yaw=0,drag=false,lastX=0,frame=0
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
          if(farmDistance<5){setInteraction('Farm District selected. Opening the live Farm page for planting, watering, harvesting and processing.');window.location.href='/farm';return}
          if(marketDistance<6)setInteraction('Market Square: this location is a world preview. Trading is not enabled yet.')
          else if(millDistance<6)setInteraction('Garri Processing Shed: processing gameplay is not connected to this 3D scene yet.')
          else setInteraction('Move closer to the cassava plots, market or processing shed to interact.')
        }
        keys.add(key)
      }
      const up=(e:KeyboardEvent)=>keys.delete(e.key.toLowerCase())
      const start=(e:PointerEvent)=>{drag=true;lastX=e.clientX;el.setPointerCapture(e.pointerId)}
      const move=(e:PointerEvent)=>{if(drag){yaw+=(e.clientX-lastX)*.006;lastX=e.clientX}}
      const end=()=>drag=false
      window.addEventListener('keydown',down);window.addEventListener('keyup',up)
      el.addEventListener('pointerdown',start);el.addEventListener('pointermove',move);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end)
      const draw=()=>{
        const w=el.clientWidth,h=el.clientHeight,dpr=Math.min(devicePixelRatio||1,1.5)
        if(el.width!==Math.round(w*dpr)||el.height!==Math.round(h*dpr)){el.width=Math.round(w*dpr);el.height=Math.round(h*dpr)}
        gl.viewport(0,0,el.width,el.height);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clearColor(.48,.69,.83,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT)
        const step=.12
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
        gl.drawArrays(gl.TRIANGLES,0,vertices.length/3);frame=requestAnimationFrame(draw)
      }
      draw()
      return ()=>{cancelAnimationFrame(frame);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);el.removeEventListener('pointerdown',start);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',end);el.removeEventListener('pointercancel',end);gl.deleteBuffer(vb);gl.deleteBuffer(cb);gl.deleteProgram(program)}
    }catch(e){setError(e instanceof Error?e.message:'3D scene could not start')}
  },[])
  return <main className="fixed inset-0 overflow-hidden bg-[#16251d] text-white">
    <canvas ref={canvas} className="h-full w-full touch-pan-y" aria-label="GARRIVERSE 3D village preview"/>
    <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-white/20 bg-black/55 px-4 py-3 backdrop-blur">
      <div className="text-xs font-black tracking-[.24em] text-amber-300">GARRIVERSE 2026</div>
      <div className="mt-1 text-lg font-bold">Living Town · 3D prototype</div>
      <div className="text-xs text-white/70">{hint} · Press E to interact</div>
    </div>
    <a href="/" className="absolute right-4 top-4 rounded-xl bg-black/60 px-4 py-3 text-sm font-semibold">← Back to town</a>
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-4 py-2 text-xs text-white/80">WASD / Arrow keys · Drag to look · Prototype preview</div>
    {error&&<div role="alert" className="absolute bottom-20 left-4 right-4 rounded-xl bg-red-950/90 p-3 text-sm">{error}</div>}
  </main>
}
