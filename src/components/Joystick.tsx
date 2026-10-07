import { useRef, useState } from 'react'

export function Joystick({ onMove }: { onMove: (dx: number, dy: number) => void }) {
  const base = useRef<HTMLDivElement>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const active = useRef<number | null>(null)

  const update = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect()
    const max = r.width / 2
    let x = e.clientX - (r.left + max)
    let y = e.clientY - (r.top + max)
    const d = Math.hypot(x, y)
    if (d > max) { x = (x / d) * max; y = (y / d) * max }
    setKnob({ x, y })
    onMove(x / max, y / max)
  }
  const end = () => { active.current = null; setKnob({ x: 0, y: 0 }); onMove(0, 0) }

  return (
    <div
      ref={base}
      className="relative h-32 w-32 touch-none rounded-full border-2 border-cream/20 bg-ink/40 backdrop-blur"
      onPointerDown={(e) => { active.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); update(e) }}
      onPointerMove={(e) => active.current === e.pointerId && update(e)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div
        className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full bg-gold/90 shadow-[0_4px_0_#9a6b0b]"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  )
}
