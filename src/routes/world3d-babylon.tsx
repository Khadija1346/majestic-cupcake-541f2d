import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { farmAction, getFarm } from '@/server/farm.functions'

export const Route = createFileRoute('/world3d-babylon')({ component: BabylonWorld })

declare global {
  interface Window { BABYLON?: any }
}

function BabylonWorld() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const keys = useRef(new Set<string>())
  const [status, setStatus] = useState('Loading the new 3D world…')
  const [nearby, setNearby] = useState('')
  const [farm, setFarm] = useState<Awaited<ReturnType<typeof getFarm>> | null>(null)
  const [farmOpen, setFarmOpen] = useState(false)
  const [waterOpen, setWaterOpen] = useState(false)
  const [marketOpen, setMarketOpen] = useState(false)
  const [officeOpen, setOfficeOpen] = useState(false)
  const [farmLoading, setFarmLoading] = useState(true)
  const [farmBusy, setFarmBusy] = useState<string | null>(null)
  const [farmError, setFarmError] = useState('')
  const reloadFarm = async () => {
    try {
      setFarmError('')
      setFarm(await getFarm())
    } catch (error) {
      setFarmError(error instanceof Error ? error.message : 'Could not load saved farm data.')
    } finally {
      setFarmLoading(false)
    }
  }
  useEffect(() => { void reloadFarm() }, [])
  const runFarmAction = async (action: 'plant' | 'water' | 'harvest' | 'process', plotId?: string) => {
    if (farmBusy) return
    const key = plotId ? action + ':' + plotId : action
    setFarmBusy(key)
    setFarmError('')
    try {
      setFarm(await farmAction({ data: { action, plotId } }))
    } catch (error) {
      setFarmError(error instanceof Error ? error.message : 'Farm action failed. Please retry.')
      await reloadFarm()
    } finally {
      setFarmBusy(null)
    }
  }

  useEffect(() => {
    let disposed = false
    let engine: any
    let scene: any
    let lastTime = 0
    let drag = false
    let lastX = 0
    let lastY = 0
    let camera: any
    let player: any
    let playerYaw = 0
    const canvas = canvasRef.current
    if (!canvas) return

    const start = async () => {
      try {
        if (!window.BABYLON) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector<HTMLScriptElement>('script[data-garriverse-babylon]')
            if (existing && window.BABYLON) return resolve()
            const script = existing ?? document.createElement('script')
            script.src = 'https://cdn.babylonjs.com/babylon.js'
            script.async = true
            script.dataset.garriverseBabylon = 'true'
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('Babylon.js could not load. Check your internet connection and reload.'))
            if (!existing) document.head.appendChild(script)
          })
        }
        if (disposed) return
        const B = window.BABYLON
        if (!B) throw new Error('Babylon.js did not initialize.')
        engine = new B.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true, adaptToDeviceRatio: true }, true)
        // Cap effective render resolution on dense mobile screens to keep frame times stable.
        engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / 1.5))
        scene = new B.Scene(engine)
        scene.clearColor = new B.Color4(0.48, 0.72, 0.88, 1)
        scene.collisionsEnabled = true
        scene.gravity = new B.Vector3(0, -0.25, 0)
        scene.fogMode = B.Scene.FOGMODE_EXP2
        scene.fogDensity = 0.003
        scene.fogColor = new B.Color3(0.68, 0.78, 0.67)

        const hemi = new B.HemisphericLight('sunFill', new B.Vector3(0, 1, 0), scene)
        hemi.intensity = 0.82
        const sun = new B.DirectionalLight('afternoonSun', new B.Vector3(-0.45, -1, 0.3), scene)
        sun.position = new B.Vector3(25, 35, -20)
        sun.intensity = 1.25

        const mat = (name: string, color: string, roughness = 0.9) => {
          const m = new B.StandardMaterial(name, scene)
          m.diffuseColor = B.Color3.FromHexString(color)
          m.specularColor = new B.Color3(0.12, 0.12, 0.12)
          m.roughness = roughness
          return m
        }
        const grass = mat('savanna grass', '#638b45')
        const path = mat('warm earth road', '#bd8959')
        const soil = mat('rich cassava soil', '#70452b')
        const leaf = mat('cassava leaves', '#397b37')
        const leafLight = mat('young leaves', '#6b9c3d')
        const wood = mat('timber', '#69432b')
        const wallA = mat('clay plaster', '#d3a06d')
        const wallB = mat('sun baked cream', '#e2c28c')
        const roof = mat('terracotta roof', '#8c4630')
        const blue = mat('water', '#3b91c5', 0.35)
        const dark = mat('dark fabric', '#29313a')
        const cloths = ['#c65b32', '#286c67', '#d6a53c', '#5865a5', '#8b5a88'].map((c, i) => mat('cloth ' + i, c))

        const ground = B.MeshBuilder.CreateGround('village ground', { width: 110, height: 110, subdivisions: 2 }, scene)
        ground.material = grass
        ground.checkCollisions = true

        const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, material: any) => {
          const mesh = B.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene)
          mesh.position.set(x, y + h / 2, z)
          mesh.material = material
          mesh.checkCollisions = true
          return mesh
        }
        const road = (name: string, x: number, z: number, w: number, d: number) => {
          const m = B.MeshBuilder.CreateGround(name, { width: w, height: d }, scene)
          m.position.set(x, 0.025, z)
          m.material = path
          return m
        }
        road('main village road', 0, 0, 9, 95)
        road('cross village road', 0, 0, 85, 7)
        road('farm lane', 22, 20, 8, 37)
        road('water district lane', -9, 19, 7, 31)
        road('market lane', -25, 7, 28, 6)

        const house = (x: number, z: number, wall: any, scale = 1) => {
          box('village home', x, 0, z, 8 * scale, 3.4 * scale, 7 * scale, wall)
          const r = B.MeshBuilder.CreateBox('pitched clay roof', { width: 9 * scale, height: 0.55 * scale, depth: 8 * scale }, scene)
          r.position.set(x, 3.55 * scale, z)
          r.rotation.z = -0.13
          r.material = roof
          const door = box('wooden doorway', x, 0, z - 3.56 * scale, 1.35 * scale, 2.35 * scale, 0.12, wood)
          door.checkCollisions = false
          for (let n = -1; n <= 1; n++) {
            const window = box('window', x + n * 2.3 * scale, 1.45 * scale, z - 3.58 * scale, 0.9 * scale, 0.85 * scale, 0.08, blue)
            window.checkCollisions = false
          }
        }
        house(-17, -14, wallA, 1.05)
        house(17, -16, wallB, 1.1)
        house(-19, 14, wallB, 0.92)
        house(18, 15, wallA, 1)
        house(-34, -2, wallA, 0.85)
        box('moderator office', -34, 0, -27, 9, 4, 7, wallB)
        const officeRoof = B.MeshBuilder.CreateBox('moderator office roof', { width: 10, height: .65, depth: 8 }, scene)
        officeRoof.position.set(-34, 4.2, -27); officeRoof.material = roof
        box('office signboard', -34, 3.2, -23.2, 5.2, .8, .12, wood).checkCollisions = false

        const palm = (x: number, z: number) => {
          const trunk = B.MeshBuilder.CreateCylinder('palm trunk', { height: 5.4, diameterTop: 0.32, diameterBottom: 0.58, tessellation: 8 }, scene)
          trunk.position.set(x, 2.7, z)
          trunk.material = wood
          for (let i = 0; i < 7; i++) {
            const frond = B.MeshBuilder.CreateCylinder('palm frond', { height: 3.4, diameterTop: 0.04, diameterBottom: 0.19, tessellation: 5 }, scene)
            frond.position.set(x + Math.cos(i * Math.PI / 3.5) * 1.25, 5.25, z + Math.sin(i * Math.PI / 3.5) * 1.25)
            frond.rotation.z = Math.PI / 2.7
            frond.rotation.y = i * Math.PI / 3.5
            frond.material = leaf
          }
        }
        for (const [x, z] of [[-29,-22],[-7,-25],[28,-25],[32,4],[-30,24],[7,31],[30,28],[-4,17]]) palm(x, z)

        // A real, walkable cassava field with repeated ridges and leafy plants.
        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 6; col++) {
            const x = 19 + col * 2.5
            const z = 12 + row * 3
            const bed = B.MeshBuilder.CreateGround('cassava ridge', { width: 2.15, height: 2.45 }, scene)
            bed.position.set(x, 0.08, z)
            bed.material = soil
            const stem = B.MeshBuilder.CreateCylinder('cassava stem', { height: 1.15, diameterTop: 0.1, diameterBottom: 0.16, tessellation: 6 }, scene)
            stem.position.set(x, 0.66, z)
            stem.material = wood
            for (let leafIndex = 0; leafIndex < 5; leafIndex++) {
              const l = B.MeshBuilder.CreateSphere('cassava leaf', { diameter: 0.85, segments: 5 }, scene)
              l.scaling.set(0.42, 0.1, 1)
              l.position.set(x + Math.cos(leafIndex * 1.25) * 0.48, 1.08 + (leafIndex % 2) * 0.12, z + Math.sin(leafIndex * 1.25) * 0.48)
              l.rotation.y = leafIndex * 1.25
              l.material = leafIndex % 2 ? leafLight : leaf
            }
          }
        }

        // Water District: reservoir, irrigation channels, pump house and elevated tank.
        const reservoir = B.MeshBuilder.CreateGround('water reservoir', { width: 15, height: 10 }, scene)
        reservoir.position.set(-11, 0.035, 21); reservoir.material = blue
        box('water pump house', -19, 0, 20, 5, 2.8, 4, wallB)
        const tank = B.MeshBuilder.CreateCylinder('elevated water tank', { height: 3.4, diameter: 3.8, tessellation: 20 }, scene)
        tank.position.set(-5, 4.2, 22); tank.material = blue
        const tankLegs = [[-6.3,0,20.7],[-3.7,0,20.7],[-6.3,0,23.3],[-3.7,0,23.3]]
        for (const [x,,z] of tankLegs) {
          const leg = B.MeshBuilder.CreateCylinder('water tank support', { height: 4.4, diameter: .18 }, scene)
          leg.position.set(x, 2.2, z); leg.material = wood
        }
        for (let i=0;i<3;i++) {
          const channel = B.MeshBuilder.CreateGround('irrigation channel', { width: 1.1, height: 18 }, scene)
          channel.position.set(-3 + i*2, .055, 20); channel.material = blue
        }
        // Processing shed and market stalls.
        const well = B.MeshBuilder.CreateCylinder('village well', { height: 0.75, diameter: 2.8, tessellation: 20 }, scene)
        well.position.set(-2, 0.38, 13)
        well.material = wood
        const water = B.MeshBuilder.CreateCylinder('well water', { height: 0.08, diameter: 2.25, tessellation: 24 }, scene)
        water.position.set(-2, 0.8, 13)
        water.material = blue
        box('processing shed', 33, 0, 0, 11, 4, 10, wallA)
        const millRoof = B.MeshBuilder.CreateBox('processing shed roof', { width: 12, height: 0.6, depth: 11 }, scene)
        millRoof.position.set(33, 4.1, 0); millRoof.material = roof
        for (let i = 0; i < 4; i++) {
          box('market stall counter', -31 + i * 4, 0, 8, 3.4, 1.1, 2, wood)
          const canopy = B.MeshBuilder.CreateBox('market canopy', { width: 3.8, height: 0.2, depth: 2.6 }, scene)
          canopy.position.set(-31 + i * 4, 2.6, 8); canopy.material = i % 2 ? roof : wallB
        }

        // Stylized human characters: layered clothing, shaped limbs, face, hair/headwrap and shoes.
        const skinTones = ['#8c5638', '#a66b48', '#70432f', '#bb805b'].map((c, i) => mat('skin tone ' + i, c))
        const hairMats = [mat('dark hair', '#211b19'), mat('headwrap indigo', '#315c76'), mat('headwrap cream', '#e7d6b2')]
        const trimMat = mat('woven clothing trim', '#e8c77c')
        const shoeMat = mat('leather shoes', '#33251f')
        const makePerson = (name: string, color: any, x: number, z: number, variant = 0) => {
          const root = new B.TransformNode(name, scene)
          const create = (mesh: any, y: number, px = 0, pz = 0, material: any = color) => {
            mesh.parent = root
            mesh.position.set(px, y, pz)
            mesh.material = material
            mesh.isPickable = false
            return mesh
          }
          const capsule = (part: string, height: number, radius: number, y: number, px: number, material: any, pz = 0) =>
            create(B.MeshBuilder.CreateCapsule(name + ' ' + part, { height, radius, tessellation: 12, subdivisions: 4 }, scene), y, px, pz, material)
          const sphere = (part: string, diameter: number, y: number, px: number, pz: number, material: any, sx = 1, sy = 1, sz = 1) => {
            const mesh = create(B.MeshBuilder.CreateSphere(name + ' ' + part, { diameter, segments: 16 }, scene), y, px, pz, material)
            mesh.scaling.set(sx, sy, sz)
            return mesh
          }
          const skinTone = skinTones[variant % skinTones.length]
          const hair = hairMats[variant % hairMats.length]
          // Neck and softly shaped torso with a waist sash and chest detail.
          capsule('neck', 0.34, 0.13, 1.77, 0, skinTone)
          capsule('tunic', 1.12, 0.37, 1.16, 0, color)
          const sash = B.MeshBuilder.CreateCylinder(name + ' waist sash', { height: 0.13, diameter: 0.72, tessellation: 20 }, scene)
          create(sash, 0.86, 0, 0, trimMat)
          sash.scaling.z = 0.82
          // Head, ears and readable facial features facing the camera (+Z).
          sphere('head', 0.62, 2.15, 0, 0, skinTone, 0.88, 1.05, 0.88)
          sphere('left ear', 0.16, 2.15, -0.28, 0, skinTone)
          sphere('right ear', 0.16, 2.15, 0.28, 0, skinTone)
          sphere('left eye', 0.075, 2.2, -0.115, 0.265, hair, 0.85, 1, 0.55)
          sphere('right eye', 0.075, 2.2, 0.115, 0.265, hair, 0.85, 1, 0.55)
          sphere('nose', 0.12, 2.08, 0, 0.29, skinTone, 0.72, 0.85, 0.7)
          const mouth = B.MeshBuilder.CreateSphere(name + ' smile', { diameter: 0.075, segments: 12 }, scene)
          create(mouth, 1.99, 0, 0.266, hair)
          mouth.scaling.set(1.5, 0.35, 0.4)
          // Distinct hair or wrapped headwear, not a featureless sphere.
          if (variant % 3 === 1) {
            const wrap = B.MeshBuilder.CreateSphere(name + ' wrapped headwear', { diameter: 0.68, segments: 16 }, scene)
            create(wrap, 2.39, 0, -0.015, hair)
            wrap.scaling.set(1.03, 0.46, 0.95)
            const band = B.MeshBuilder.CreateCylinder(name + ' headwrap band', { height: 0.09, diameter: 0.61, tessellation: 20 }, scene)
            create(band, 2.28, 0, 0, trimMat)
          } else {
            sphere('hair cap', 0.66, 2.42, 0, -0.035, hair, 1.02, 0.52, 0.95)
            sphere('hair fringe', 0.25, 2.31, 0, 0.22, hair, 1.5, 0.55, 0.55)
          }
          const legs: any[] = []
          const arms: any[] = []
          for (let i = 0; i < 2; i++) {
            const side = i ? 1 : -1
            const leg = capsule('leg ' + i, 0.82, 0.15, 0.42, side * 0.19, dark)
            leg.position.z = 0
            legs.push(leg)
            const shoe = B.MeshBuilder.CreateBox(name + ' shoe ' + i, { width: 0.25, height: 0.14, depth: 0.42 }, scene)
            create(shoe, 0.08, side * 0.19, 0.1, shoeMat)
            const sleeve = capsule('arm ' + i, 0.78, 0.13, 1.25, side * 0.45, color)
            sleeve.rotation.z = side * -0.12
            arms.push(sleeve)
            capsule('hand ' + i, 0.24, 0.105, 0.79, side * 0.47, skinTone, 0.015)
          }
          // A small shoulder cloth panel adds silhouette and material contrast.
          const shoulder = B.MeshBuilder.CreateBox(name + ' shoulder detail', { width: 0.52, height: 0.12, depth: 0.08 }, scene)
          create(shoulder, 1.57, 0, 0.29, trimMat)
          root.position.set(x, 0, z)
          return { root, legs, arms, home: new B.Vector3(x, 0, z), phase: Math.random() * 6, speed: 0.55 + Math.random() * 0.35 }
        }
        const playerMat = mat('player outfit', '#e66b38')
        player = makePerson('player citizen', playerMat, 0, 3)
        const npcData = [
          makePerson('farmer', cloths[1], 18, 9, 1),
          makePerson('market trader', cloths[2], -28, 4, 2),
          makePerson('processor', cloths[3], 31, -8, 3),
          makePerson('resident', cloths[0], -8, -2, 0),
          makePerson('water carrier', cloths[4], 2, 16, 1),
          makePerson('village guard', dark, -12, 21, 2),
        ]
        const cameraTarget = new B.Vector3(0, 1.1, 3)
        camera = new B.ArcRotateCamera('third person camera', -Math.PI / 2, 1.12, 13, cameraTarget, scene)
        camera.lowerRadiusLimit = 8
        camera.upperRadiusLimit = 22
        camera.lowerBetaLimit = 0.65
        camera.upperBetaLimit = 1.42
        camera.wheelPrecision = 80
        camera.panningSensibility = 0
        camera.attachControl(canvas, false)
        camera.inputs.clear()

        const onDown = (e: KeyboardEvent) => keys.current.add(e.key.toLowerCase())
        const onUp = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
        const onBlur = () => keys.current.clear()
        const pointerDown = (e: PointerEvent) => { drag = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId) }
        const pointerMove = (e: PointerEvent) => {
          if (!drag) return
          camera.alpha -= (e.clientX - lastX) * 0.006
          camera.beta = Math.max(0.68, Math.min(1.4, camera.beta + (e.clientY - lastY) * 0.004))
          lastX = e.clientX; lastY = e.clientY
        }
        const pointerUp = () => { drag = false }
        window.addEventListener('keydown', onDown)
        window.addEventListener('keyup', onUp)
        window.addEventListener('blur', onBlur)
        canvas.addEventListener('pointerdown', pointerDown)
        canvas.addEventListener('pointermove', pointerMove)
        canvas.addEventListener('pointerup', pointerUp)
        canvas.addEventListener('pointercancel', pointerUp)

        scene.onBeforeRenderObservable.add(() => {
          const now = performance.now()
          const dt = Math.min(0.04, lastTime ? (now - lastTime) / 1000 : 0.016)
          lastTime = now
          const input = keys.current
          let forward = Number(input.has('w') || input.has('arrowup')) - Number(input.has('s') || input.has('arrowdown'))
          let side = Number(input.has('d') || input.has('arrowright')) - Number(input.has('a') || input.has('arrowleft'))
          const length = Math.hypot(forward, side) || 1
          forward /= length; side /= length
          const angle = camera.alpha
          const vx = (-Math.sin(angle) * forward + Math.cos(angle) * side) * 5.2 * dt
          const vz = (-Math.cos(angle) * forward - Math.sin(angle) * side) * 5.2 * dt
          player.root.position.x = Math.max(-43, Math.min(43, player.root.position.x + vx))
          player.root.position.z = Math.max(-43, Math.min(43, player.root.position.z + vz))
          if (Math.abs(vx) + Math.abs(vz) > 0.001) {
            playerYaw = Math.atan2(vx, vz)
            player.root.rotation.y = playerYaw
            const swing = Math.sin(now * 0.012) * 0.48
            player.root.getChildMeshes().filter((m: any) => m.name.includes('leg')).forEach((m: any, i: number) => { m.rotation.x = i ? swing : -swing })
            player.root.getChildMeshes().filter((m: any) => m.name.includes('arm')).forEach((m: any, i: number) => { m.rotation.x = i ? -swing * 0.7 : swing * 0.7 })
          }
          camera.target.copyFrom(player.root.position.add(new B.Vector3(0, 1.15, 0)))
          npcData.forEach((npc, i) => {
            const phase = now * 0.00022 * npc.speed + npc.phase
            const x = npc.home.x + Math.sin(phase) * (i % 2 ? 3.5 : 5)
            const z = npc.home.z + Math.cos(phase * 0.8) * 2.5
            npc.root.position.x = x; npc.root.position.z = z
            npc.root.rotation.y = Math.atan2(Math.cos(phase) * 3.5, -Math.sin(phase) * 2.5)
            const swing = Math.sin(now * 0.006 * npc.speed + npc.phase) * 0.38
            npc.legs.forEach((m: any, j: number) => { m.rotation.x = j ? swing : -swing })
            npc.arms.forEach((m: any, j: number) => { m.rotation.x = j ? -swing : swing })
          })
          const dFarm = B.Vector3.Distance(player.root.position, new B.Vector3(23, 0, 17))
          const dMarket = B.Vector3.Distance(player.root.position, new B.Vector3(-25, 0, 8))
          const dMill = B.Vector3.Distance(player.root.position, new B.Vector3(33, 0, 0))
          const dWater = B.Vector3.Distance(player.root.position, new B.Vector3(-11, 0, 21))
          const dOffice = B.Vector3.Distance(player.root.position, new B.Vector3(-34, 0, -27))
          const next = dFarm < 7 ? 'Farm District' : dWater < 8 ? 'Water District' : dMarket < 8 ? 'Market Square' : dMill < 9 ? 'Processing District' : dOffice < 8 ? 'Moderator Office' : ''
          setNearby((old: string) => old === next ? old : next)
        })

        engine.runRenderLoop(() => { if (!disposed) scene.render() })
        const onResize = () => engine?.resize()
        window.addEventListener('resize', onResize)
        setStatus('Walk through the village. Move with the pad and drag to turn the camera.')
        return () => {
          window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp)
          window.removeEventListener('resize', onResize)
          canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove)
          canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointercancel', pointerUp)
        }
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'The 3D world could not start.')
      }
    }
    let removeInput: (() => void) | undefined
    void start().then(cleanup => { removeInput = cleanup })
    return () => {
      disposed = true
      removeInput?.()
      scene?.dispose()
      engine?.dispose()
    }
  }, [])

  const press = (key: string, down: boolean) => {
    if (down) keys.current.add(key)
    else keys.current.delete(key)
  }

  return <main className="fixed inset-0 overflow-hidden bg-[#315c36] text-white">
    <canvas ref={canvasRef} className="h-full w-full touch-none" aria-label="GARRIVERSE Babylon.js 3D village" />
    <header className="pointer-events-none absolute left-3 right-3 top-3 rounded-2xl border border-white/20 bg-[#12251c]/85 p-4 shadow-xl backdrop-blur">
      <div className="text-xs font-black tracking-[0.25em] text-amber-300">GARRIVERSE 2026 · NEW 3D ENGINE</div>
      <div className="mt-1 text-xl font-black">Living Village</div>
      <div className="mt-1 text-xs text-white/80">{status}</div>
      {nearby && <div className="mt-2 inline-block rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-black">Nearby: {nearby} · tap INTERACT</div>}
    </header>
    <div className="absolute right-3 top-28 flex gap-2">
      <a href="/bank" className="rounded-xl border border-white/20 bg-[#14251f]/90 px-3 py-2 text-xs font-black shadow-lg">WALLET</a>
      <a href="/moderator" className="rounded-xl border border-white/20 bg-[#14251f]/90 px-3 py-2 text-xs font-black shadow-lg">MOD OFFICE</a>
    </div>
    <div className="absolute bottom-5 left-4 flex flex-col items-center gap-2 select-none">
      <button aria-label="Move forward" className="h-14 w-14 rounded-2xl border border-white/30 bg-black/70 text-2xl font-black active:bg-amber-400 active:text-black" onPointerDown={e => { e.preventDefault(); press('w', true) }} onPointerUp={() => press('w', false)} onPointerCancel={() => press('w', false)} onPointerLeave={() => press('w', false)}>↑</button>
      <div className="flex gap-2">
        <button aria-label="Move left" className="h-14 w-14 rounded-2xl border border-white/30 bg-black/70 text-2xl font-black active:bg-amber-400 active:text-black" onPointerDown={e => { e.preventDefault(); press('a', true) }} onPointerUp={() => press('a', false)} onPointerCancel={() => press('a', false)} onPointerLeave={() => press('a', false)}>←</button>
        <button aria-label="Move backward" className="h-14 w-14 rounded-2xl border border-white/30 bg-black/70 text-2xl font-black active:bg-amber-400 active:text-black" onPointerDown={e => { e.preventDefault(); press('s', true) }} onPointerUp={() => press('s', false)} onPointerCancel={() => press('s', false)} onPointerLeave={() => press('s', false)}>↓</button>
        <button aria-label="Move right" className="h-14 w-14 rounded-2xl border border-white/30 bg-black/70 text-2xl font-black active:bg-amber-400 active:text-black" onPointerDown={e => { e.preventDefault(); press('d', true) }} onPointerUp={() => press('d', false)} onPointerCancel={() => press('d', false)} onPointerLeave={() => press('d', false)}>→</button>
      </div>
    </div>
    <button className="absolute bottom-10 right-5 rounded-2xl bg-amber-400 px-6 py-4 font-black text-black shadow-xl active:scale-95" onClick={() => { if (nearby === 'Farm District' || nearby === 'Processing District') setFarmOpen(true); else if (nearby === 'Water District') setWaterOpen(true); else if (nearby === 'Market Square') setMarketOpen(true); else if (nearby === 'Moderator Office') setOfficeOpen(true); else setStatus('Walk closer to a marked district first.') }}>INTERACT</button>
    {waterOpen && <section className="absolute bottom-28 right-3 z-20 max-h-[55vh] w-[min(92vw,390px)] overflow-y-auto rounded-2xl border border-sky-200/30 bg-[#102b36]/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between"><div><div className="text-xs font-black tracking-widest text-sky-300">WATER DISTRICT</div><h2 className="text-lg font-black">Irrigation Station</h2></div><button className="rounded-lg bg-white/10 px-3 py-2 text-sm" onClick={() => setWaterOpen(false)}>Close</button></div>
      <p className="mt-2 text-sm text-white/70">Use the village water network to irrigate your growing cassava. Watering is saved through the farm server.</p>
      {farm?.plots.filter(p => p.state === 'growing' && !p.wateredAt).map((plot) => <button key={plot.id} disabled={!!farmBusy} onClick={() => void runFarmAction('water', plot.id)} className="mt-3 w-full rounded-xl bg-sky-700 px-3 py-3 text-left text-sm font-bold disabled:opacity-40">Water growing plot · {plot.id.slice(0, 8)}</button>)}
      {!farm?.plots.some(p => p.state === 'growing' && !p.wateredAt) && <div className="mt-3 rounded-xl bg-white/10 p-3 text-sm text-white/70">No dry growing plots right now. Plant cassava first, then return here to irrigate it.</div>}
      {farmError && <p role="alert" className="mt-3 text-sm text-red-200">{farmError}</p>}
      <button onClick={() => { setWaterOpen(false); setFarmOpen(true) }} className="mt-3 w-full rounded-xl border border-white/20 px-3 py-2 text-sm font-bold">Open full Farm District</button>
    </section>}
    {marketOpen && <section className="absolute bottom-28 right-3 z-20 max-h-[55vh] w-[min(92vw,390px)] overflow-y-auto rounded-2xl border border-amber-200/30 bg-[#2b2017]/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between"><div><div className="text-xs font-black tracking-widest text-amber-300">MARKET SQUARE</div><h2 className="text-lg font-black">Garri Market</h2></div><button className="rounded-lg bg-white/10 px-3 py-2 text-sm" onClick={() => setMarketOpen(false)}>Close</button></div>
      <p className="mt-2 text-sm text-white/70">Your current server-saved stock. Trading and token settlement are not enabled until the project team approves a real market contract and pricing rules.</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">{[['Seeds',farm?.seeds ?? '—'],['Cassava',farm?.cassava ?? '—'],['Garri',farm?.garri ?? '—']].map(([label,value]) => <div key={label} className="rounded-xl bg-white/10 p-3"><b className="block text-xl">{value}</b>{label}</div>)}</div>
      <a href="/market" className="mt-3 block rounded-xl bg-amber-400 px-3 py-3 text-center text-sm font-black text-black">Open Market page</a>
      <p className="mt-2 text-[10px] text-white/45">No fake listings, simulated sales, cash-out or $GARRI payouts are shown here.</p>
    </section>}
    {officeOpen && <section className="absolute bottom-28 right-3 z-20 w-[min(92vw,390px)] rounded-2xl border border-violet-200/30 bg-[#211a32]/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between"><div><div className="text-xs font-black tracking-widest text-violet-300">GARRIVERSE OPERATIONS</div><h2 className="text-lg font-black">Moderator Office</h2></div><button className="rounded-lg bg-white/10 px-3 py-2 text-sm" onClick={() => setOfficeOpen(false)}>Close</button></div>
      <p className="mt-2 text-sm text-white/70">Staff access is protected by Netlify Identity and server-side role checks. A Citizen account alone does not grant moderator privileges.</p>
      <a href="/moderator" className="mt-3 block rounded-xl bg-violet-500 px-3 py-3 text-center text-sm font-black">Enter Moderator Office</a>
      <a href="https://t.me/Defi_deeja2" target="_blank" rel="noreferrer" className="mt-2 block rounded-xl border border-white/20 px-3 py-3 text-center text-sm font-bold">Contact Game Admin</a>
    </section>}
    {farmOpen && <section className="absolute bottom-28 right-3 z-20 max-h-[55vh] w-[min(92vw,390px)] overflow-y-auto rounded-2xl border border-amber-200/30 bg-[#14251f]/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div><div className="text-xs font-black tracking-widest text-amber-300">SERVER-SAVED FARM</div><h2 className="text-lg font-black">Cassava District</h2></div>
        <button className="rounded-lg bg-white/10 px-3 py-2 text-sm" onClick={() => setFarmOpen(false)}>Close</button>
      </div>
      {farmLoading ? <p className="py-5 text-sm text-white/70">Loading your saved farm…</p> : <>
        {farm && <div className="my-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-white/10 p-2"><b className="block text-lg">{farm.seeds}</b>Stems</div>
          <div className="rounded-xl bg-white/10 p-2"><b className="block text-lg">{farm.cassava}</b>Cassava</div>
          <div className="rounded-xl bg-white/10 p-2"><b className="block text-lg">{farm.garri}</b>Garri</div>
        </div>}
        {farm?.plots.map((plot, index) => {
          const ready = plot.state === 'growing' && !!plot.readyAt && Date.parse(plot.readyAt) <= Date.now()
          const busy = !!farmBusy
          return <div key={plot.id} className="mb-2 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="mb-2 flex justify-between text-sm"><b>Plot {index + 1}</b><span className="text-amber-200">{plot.state === 'empty' ? 'Empty' : ready ? 'Ready to harvest' : 'Growing'}</span></div>
            {plot.state === 'empty' ? <button disabled={busy || farm.seeds < 1} className="w-full rounded-lg bg-amber-400 px-3 py-2 text-sm font-bold text-black disabled:opacity-40" onClick={() => void runFarmAction('plant', plot.id)}>{farmBusy === 'plant:' + plot.id ? 'Planting…' : 'Plant cassava'}</button> : <div className="flex gap-2">
              {!plot.wateredAt && !ready && <button disabled={busy} className="flex-1 rounded-lg bg-sky-700 px-2 py-2 text-xs font-bold disabled:opacity-40" onClick={() => void runFarmAction('water', plot.id)}>Water</button>}
              <button disabled={busy || !ready} className="flex-1 rounded-lg bg-amber-400 px-2 py-2 text-xs font-bold text-black disabled:opacity-40" onClick={() => void runFarmAction('harvest', plot.id)}>Harvest</button>
            </div>}
          </div>
        })}
        <button disabled={!farm || farm.cassava < 3 || !!farmBusy} className="mt-1 w-full rounded-lg bg-emerald-700 px-3 py-3 text-sm font-bold disabled:opacity-40" onClick={() => void runFarmAction('process')}>{farmBusy === 'process' ? 'Processing…' : 'Process 3 cassava into garri'}</button>
      </>}
      {farmError && <div role="alert" className="mt-3 rounded-lg border border-red-300/30 bg-red-950/60 p-3 text-xs text-red-100">{farmError}<button className="ml-2 underline" onClick={() => void reloadFarm()}>Retry</button></div>}
      <p className="mt-3 text-[10px] text-white/50">Inventory and crop actions are validated and saved by the game server. These are in-game resources, not cash or withdrawable tokens.</p>
    </section>}
    <div className="pointer-events-none absolute bottom-2 right-5 text-[10px] text-white/65">Drag anywhere on the world to look around</div>
  </main>
}

