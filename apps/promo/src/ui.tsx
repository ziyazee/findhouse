import React from 'react'
import { interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing } from 'remotion'

export const C = {
  navy: '#062247',
  navy2: '#0b3166',
  ink: '#1c2430',
  mute: '#5b6676',
  line: '#e6e9ee',
  coral: '#e8745a',
  mint: '#dff3e7',
  peach: '#ffe9de',
  lav: '#ece8fb',
  sky: '#e3f0fb',
  sun: '#fff3cf',
}

export const FONT = "'DM Sans', system-ui, sans-serif"

export const FontFace: React.FC = () => (
  <style>{`
    @font-face{font-family:'DM Sans';font-weight:400 700;src:url('${staticFile('dm-sans-latin.woff2')}') format('woff2');
      unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;}
    @font-face{font-family:'DM Sans';font-weight:400 700;src:url('${staticFile('dm-sans-latin-ext.woff2')}') format('woff2');
      unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+20A0-20AB,U+20AD-20C4,U+2113;}
  `}</style>
)

export const useVertical = () => {
  const { width, height } = useVideoConfig()
  return height > width
}

/** Spring 0 -> 1 starting at `delay` frames. */
export const usePop = (delay = 0, damping = 14) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - delay, fps, config: { damping, stiffness: 140 } })
}

export const Pop: React.FC<{ delay?: number; children: React.ReactNode; style?: React.CSSProperties; from?: 'bottom' | 'left' | 'right' }> = ({
  delay = 0,
  children,
  style,
  from = 'bottom',
}) => {
  const p = usePop(delay)
  const d = (1 - p) * 24
  const tx = from === 'left' ? -d : from === 'right' ? d : 0
  const ty = from === 'bottom' ? d : 0
  return (
    <div style={{ opacity: Math.min(1, p * 1.6), transform: `translate(${tx}px, ${ty}px) scale(${0.92 + 0.08 * p})`, ...style }}>
      {children}
    </div>
  )
}

/** Fades a scene in and out at its edges. */
export const SceneFade: React.FC<{ duration: number; children: React.ReactNode; bg: string }> = ({ duration, children, bg }) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 10, duration - 10, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  return <div style={{ position: 'absolute', inset: 0, background: bg, opacity, fontFamily: FONT }}>{children}</div>
}

export const Phone: React.FC<{ scale: number; children: React.ReactNode }> = ({ scale, children }) => (
  <div style={{ width: 406 * scale, height: 796 * scale, flex: 'none' }}>
    <div
      style={{
        width: 406,
        height: 796,
        transform: `scale(${scale})`,
        transformOrigin: '0 0',
        borderRadius: 58,
        background: '#10151c',
        padding: 8,
        boxSizing: 'border-box',
        boxShadow: '0 40px 80px rgba(6,34,71,.30)',
      }}
    >
      <div style={{ width: 390, height: 780, borderRadius: 50, overflow: 'hidden', background: '#fff', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 12, left: '50%', marginLeft: -50, width: 100, height: 26, borderRadius: 99, background: '#10151c', zIndex: 20 }} />
        {children}
      </div>
    </div>
  </div>
)

/** Caption block: headline + optional sub. */
export const Caption: React.FC<{ title: React.ReactNode; sub?: string; color?: string; align?: 'left' | 'center' }> = ({
  title,
  sub,
  color = C.navy,
  align,
}) => {
  const vertical = useVertical()
  const a = align ?? (vertical ? 'center' : 'left')
  return (
    <div style={{ textAlign: a, maxWidth: vertical ? 900 : 760 }}>
      <Pop>
        <div style={{ fontSize: vertical ? 84 : 84, fontWeight: 700, lineHeight: 1.04, letterSpacing: '-0.03em', color }}>{title}</div>
      </Pop>
      {sub ? (
        <Pop delay={10}>
          <div style={{ fontSize: vertical ? 38 : 36, marginTop: 24, color: color === '#fff' ? 'rgba(255,255,255,.8)' : C.mute, lineHeight: 1.35 }}>{sub}</div>
        </Pop>
      ) : null}
    </div>
  )
}

/** Caption + visual laid out side by side (landscape) or stacked (vertical). */
export const Split: React.FC<{ caption: React.ReactNode; children: React.ReactNode }> = ({ caption, children }) => {
  const vertical = useVertical()
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: vertical ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: vertical ? 40 : 110,
        padding: vertical ? '90px 70px 40px' : '0 140px',
      }}
    >
      {caption}
      {children}
    </div>
  )
}

// ---------- WhatsApp pieces ----------
export const WaHeader: React.FC = () => (
  <div style={{ background: '#075e54', color: '#fff', padding: '54px 18px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
    <div style={{ width: 40, height: 40, borderRadius: 20, background: '#fff', display: 'grid', placeItems: 'center' }}>
      <img src={staticFile('logo-mark.png')} style={{ width: 28, height: 28 }} />
    </div>
    <div style={{ fontWeight: 700, fontSize: 18, lineHeight: 1.1 }}>
      FindHouse
      <div style={{ fontSize: 12, fontWeight: 400, opacity: 0.8 }}>online</div>
    </div>
  </div>
)

export const WaBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: 'absolute', top: 108, left: 0, right: 0, bottom: 56, background: '#e7ddd3', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
    {children}
  </div>
)

export const WaInput: React.FC = () => (
  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, background: '#f0f0f0', display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px' }}>
    <div style={{ flex: 1, background: '#fff', borderRadius: 99, padding: '8px 14px', color: '#999', fontSize: 15 }}>Message</div>
    <div style={{ width: 38, height: 38, borderRadius: 19, background: '#128c7e', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 16 }}>➤</div>
  </div>
)

export const Bubble: React.FC<{ out?: boolean; children: React.ReactNode; time?: string; ticks?: boolean; style?: React.CSSProperties }> = ({
  out,
  children,
  time = '10:41',
  ticks,
  style,
}) => (
  <div
    style={{
      maxWidth: '84%',
      alignSelf: out ? 'flex-end' : 'flex-start',
      background: out ? '#d9fdd3' : '#fff',
      borderRadius: 10,
      padding: '8px 12px',
      fontSize: 17,
      lineHeight: 1.35,
      color: '#111',
      boxShadow: '0 1px 1px rgba(0,0,0,.12)',
      ...style,
    }}
  >
    {children}
    <div style={{ textAlign: 'right', fontSize: 11, color: '#667', marginTop: 2 }}>
      {time} {ticks ? <span style={{ color: '#34b7f1' }}>✓✓</span> : null}
    </div>
  </div>
)

export const photo = (name: string) => staticFile(`${name}.jpg`)

export const ease = Easing.bezier(0.45, 0, 0.2, 1)
