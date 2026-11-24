import React from 'react'
import { interpolate, staticFile, useCurrentFrame } from 'remotion'
import {
  Bubble,
  C,
  Caption,
  Phone,
  Pop,
  SceneFade,
  Split,
  WaBody,
  WaInput,
  ease,
  photo,
  usePop,
  useVertical,
} from './ui'

const useScale = () => (useVertical() ? 1.4 : 1.12)
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

// ---------------------------------------------------------------- Intro
export const IntroScene: React.FC<{ duration: number }> = ({ duration }) => {
  const vertical = useVertical()
  const logo = usePop(4, 10)
  const points: Array<[string, string]> = [
    ['📲', 'Send photos on WhatsApp'],
    ['🌐', 'Get your own property website'],
    ['📊', 'Manage and track everything'],
  ]
  return (
    <SceneFade
      duration={duration}
      bg={`radial-gradient(1200px 800px at 85% 8%, rgba(157,192,255,.3), transparent 60%), linear-gradient(170deg,#0f3d80 0%,${C.navy} 58%,#031430 100%)`}
    >
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 36, padding: '0 80px', textAlign: 'center' }}>
        <div style={{ opacity: Math.min(1, logo), transform: `scale(${0.6 + 0.4 * logo})` }}>
          <img src={staticFile('logo-mark.png')} style={{ width: vertical ? 190 : 150, height: vertical ? 190 : 150, borderRadius: 40, background: '#fff', padding: 14 }} />
        </div>
        <Pop delay={14}>
          <div style={{ fontSize: 34, letterSpacing: '.2em', textTransform: 'uppercase', color: '#ffb59f', fontWeight: 700 }}>Introducing</div>
        </Pop>
        <Pop delay={20}>
          <div style={{ fontSize: vertical ? 150 : 140, fontWeight: 700, color: '#fff', letterSpacing: '-.04em', lineHeight: 1 }}>FindHouse</div>
        </Pop>
        <Pop delay={36}>
          <div style={{ fontSize: vertical ? 48 : 46, color: 'rgba(255,255,255,.85)', maxWidth: 1100, lineHeight: 1.3 }}>
            The easiest way for brokers to list homes. Just send details on WhatsApp. We build the website.
          </div>
        </Pop>
        <div style={{ display: 'flex', flexDirection: vertical ? 'column' : 'row', gap: 22, marginTop: 14 }}>
          {points.map(([e, t], i) => (
            <Pop key={t} delay={70 + i * 14}>
              <div style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.28)', borderRadius: 99, padding: '16px 36px', fontSize: 36, fontWeight: 600, color: '#fff' }}>
                {e} {t}
              </div>
            </Pop>
          ))}
        </div>
      </div>
    </SceneFade>
  )
}

// ---------------------------------------------------------------- Share with customer, customer is happy
const FloatEmoji: React.FC<{ emoji: string; start: number; x: number; size: number }> = ({ emoji, start, x, size }) => {
  const frame = useCurrentFrame()
  const t = frame - start
  if (t < 0) return null
  const y = interpolate(t, [0, 80], [0, -420], { ...clamp, easing: ease })
  const o = interpolate(t, [0, 10, 60, 80], [0, 1, 1, 0], clamp)
  return <div style={{ position: 'absolute', left: x, bottom: 120, fontSize: size, opacity: o, transform: `translateY(${y}px) rotate(${Math.sin(t / 8) * 12}deg)` }}>{emoji}</div>
}

export const ShareHappyScene: React.FC<{ duration: number }> = ({ duration }) => {
  const scale = useScale()
  const frame = useCurrentFrame()
  const happy = usePop(70)
  return (
    <SceneFade duration={duration} bg={`linear-gradient(180deg, ${C.sun}, #fff)`}>
      <Split caption={<Caption title={<>Share in one tap. <span style={{ color: C.coral }}>Customers love it.</span></>} sub="One clean link instead of a flood of photos. Customers call or WhatsApp you straight from the page." />}>
        <div style={{ position: 'relative' }}>
          <Phone scale={scale}>
            <div style={{ background: '#075e54', color: '#fff', padding: '54px 18px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 20, background: '#ffd9c9', display: 'grid', placeItems: 'center', fontSize: 22 }}>👩</div>
              <div style={{ fontWeight: 700, fontSize: 18, lineHeight: 1.1 }}>Priya (customer)<div style={{ fontSize: 12, fontWeight: 400, opacity: 0.8 }}>online</div></div>
            </div>
            <WaBody>
              <Pop delay={8} from="right" style={{ alignSelf: 'flex-end', maxWidth: '88%' }}>
                <Bubble out ticks time="11:05" style={{ maxWidth: '100%' }}>
                  Hi Priya, here is the 2 BHK I told you about 👇
                  <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', marginTop: 6 }}>
                    <div style={{ height: 110, background: `url(${photo('exterior')}) center 30%/cover` }} />
                    <div style={{ padding: '6px 10px', fontSize: 15 }}><b>2 BHK in Andheri West</b><br /><span style={{ color: '#667' }}>₹47,000 a month</span></div>
                    <div style={{ color: '#1a73e8', fontSize: 12, padding: '0 10px 8px' }}>ravi-homes.findhouse.in/k3f9x2ab</div>
                  </div>
                </Bubble>
              </Pop>
              {frame >= 70 && (
                <Pop delay={70} from="left" style={{ alignSelf: 'flex-start' }}>
                  <Bubble time="11:06">Wow, this looks great! 😍</Bubble>
                </Pop>
              )}
              {frame >= 100 && (
                <Pop delay={100} from="left" style={{ alignSelf: 'flex-start' }}>
                  <Bubble time="11:06">Can I visit tomorrow?</Bubble>
                </Pop>
              )}
              {frame >= 130 && (
                <Pop delay={130} from="right" style={{ alignSelf: 'flex-end' }}>
                  <Bubble out ticks time="11:07">Sure! 10 AM works 👍</Bubble>
                </Pop>
              )}
            </WaBody>
            <WaInput />
          </Phone>
          {/* happy customer badge */}
          <div style={{ position: 'absolute', left: -60, top: 120, opacity: Math.min(1, happy), transform: `scale(${0.7 + 0.3 * happy}) rotate(-4deg)`, background: '#fff', borderRadius: 28, padding: '16px 26px', boxShadow: '0 18px 40px rgba(6,34,71,.22)', fontSize: 30, fontWeight: 700, color: C.navy, display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ fontSize: 56 }}>😊</span>Happy customer
          </div>
          <FloatEmoji emoji="😍" start={72} x={-30} size={64} />
          <FloatEmoji emoji="🎉" start={90} x={420} size={72} />
          <FloatEmoji emoji="❤️" start={108} x={40} size={56} />
          <FloatEmoji emoji="🏡" start={124} x={380} size={64} />
        </div>
      </Split>
    </SceneFade>
  )
}

// ---------------------------------------------------------------- Dashboard: manage + share
const TabBar: React.FC<{ active: 'Properties' | 'Performance' }> = ({ active }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 74, background: '#fff', borderTop: '1px solid #e6e9ee', display: 'flex', justifyContent: 'space-around', alignItems: 'center', fontSize: 13, color: '#7a8494', padding: '0 4px 8px' }}>
    {['Overview', 'Properties'].map((t) => <span key={t} style={{ color: t === active ? C.navy : undefined, fontWeight: t === active ? 700 : 400 }}>{t}</span>)}
    <span style={{ width: 46, height: 46, borderRadius: 23, background: C.navy, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 26, marginTop: -26, boxShadow: '0 6px 12px rgba(6,34,71,.3)' }}>+</span>
    {['Performance', 'Profile'].map((t) => <span key={t} style={{ color: t === active ? C.navy : undefined, fontWeight: t === active ? 700 : 400 }}>{t}</span>)}
  </div>
)

const STATUS = {
  Active: { color: '#2f6b4f', bg: '#edf3ee', border: '#c9dccf' },
  Rented: { color: '#2f5d7c', bg: '#edf3f7', border: '#cfdfe9' },
}

export const ManageScene: React.FC<{ duration: number }> = ({ duration }) => {
  const scale = useScale()
  const frame = useCurrentFrame()
  const status: 'Active' | 'Rented' = frame >= 70 ? 'Rented' : 'Active'
  const menuOpen = frame >= 28 && frame < 78
  const s = STATUS[status]
  const sheet = usePop(105)
  const copied = frame >= 150
  const shareActive = frame >= 96
  const caption = frame < 90 ? 'Manage every property' : 'Share your link anywhere'
  const sub = frame < 90 ? 'Set it Active, Rented or Inactive. Edit rent, details and photos any time.' : 'Copy the link or send it straight to WhatsApp, from any property.'
  return (
    <SceneFade duration={duration} bg={`linear-gradient(180deg, ${C.mint}, #fff)`}>
      <Split caption={<Caption key={caption} title={<>{caption.split(' ').slice(0, -1).join(' ')} <span style={{ color: C.coral }}>{caption.split(' ').slice(-1)}</span></>} sub={sub} />}>
        <Phone scale={scale}>
          <div style={{ height: 230, background: `#355 url(${photo('exterior')}) center 35%/cover`, position: 'relative', color: '#fff' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg,rgba(6,34,71,.9),rgba(6,34,71,0) 70%)' }} />
            <div style={{ position: 'absolute', left: 16, bottom: 14, fontWeight: 700, fontSize: 24 }}>
              <small style={{ display: 'block', fontSize: 13, fontWeight: 500 }}>Andheri West</small>2 BHK in Andheri West
            </div>
          </div>
          <div style={{ padding: 16, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <b style={{ fontSize: 28, color: C.navy }}>₹47,000</b>
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 99, padding: '7px 16px', fontSize: 16, fontWeight: 700 }}>● {status} ▾</span>
            </div>
            {menuOpen && (
              <Pop delay={28} style={{ position: 'absolute', right: 16, top: 66, zIndex: 5, width: 190, background: '#fff', border: '1px solid #e6e9ee', borderRadius: 14, boxShadow: '0 10px 28px rgba(6,34,71,.25)', padding: 5 }}>
                {(['Active', 'Rented', 'Inactive'] as const).map((o) => {
                  const picked = o === 'Rented' && frame >= 58
                  const on = o === 'Active' && frame < 58
                  return (
                    <div key={o} style={{ padding: '10px 12px', borderRadius: 9, fontSize: 17, fontWeight: 600, display: 'flex', justifyContent: 'space-between', background: picked ? '#edf3f7' : on ? '#edf3ee' : undefined, color: picked ? STATUS.Rented.color : on ? STATUS.Active.color : C.ink }}>
                      {o}
                      <span>{picked || on ? '✓' : ''}</span>
                    </div>
                  )
                })}
              </Pop>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 26 }}>
              {[['✏️', 'Edit details'], ['🖼️', 'Photos'], ['🔗', 'Share']].map(([e, t]) => {
                const hot = t === 'Share' && shareActive
                return (
                  <div key={t} style={{ textAlign: 'center', fontWeight: 600, fontSize: 15, color: hot ? '#fff' : C.navy, background: hot ? C.navy : '#fff', border: '1px solid #e6e9ee', borderRadius: 14, padding: '14px 0', transform: hot ? 'scale(1.05)' : undefined }}>
                    <div style={{ fontSize: 24 }}>{e}</div>{t}
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#e9edf3', borderRadius: 12, padding: 4, textAlign: 'center', fontWeight: 600, fontSize: 15, color: C.mute }}>
              <span style={{ background: '#fff', color: C.navy, borderRadius: 9, padding: 8 }}>Details</span><span style={{ padding: 8 }}>Photos</span>
            </div>
          </div>
          <TabBar active="Properties" />
          {frame >= 100 && (
            <>
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,34,71,.4)', opacity: Math.min(1, sheet), zIndex: 30 }} />
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 31, background: '#fff', borderRadius: '28px 28px 0 0', padding: '22px 20px 34px', transform: `translateY(${(1 - sheet) * 340}px)` }}>
                <div style={{ width: 50, height: 5, borderRadius: 9, background: '#d5dae2', margin: '0 auto 16px' }} />
                <div style={{ fontSize: 22, fontWeight: 700, color: C.navy }}>Share this home</div>
                <div style={{ marginTop: 12, background: '#f1f3f6', borderRadius: 12, padding: '12px 14px', fontSize: 15, color: C.ink, display: 'flex', justifyContent: 'space-between' }}>
                  <span>ravi-homes.findhouse.in/k3f9x2ab</span>
                  <b style={{ color: copied ? '#2f6b4f' : C.navy }}>{copied ? 'Copied ✓' : 'Copy'}</b>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <div style={{ flex: 1, height: 52, borderRadius: 15, background: '#1fa855', color: '#fff', fontWeight: 700, fontSize: 17, display: 'grid', placeItems: 'center' }}>Send on WhatsApp</div>
                  <div style={{ flex: 1, height: 52, borderRadius: 15, background: C.navy, color: '#fff', fontWeight: 700, fontSize: 17, display: 'grid', placeItems: 'center' }}>Copy link</div>
                </div>
              </div>
            </>
          )}
        </Phone>
      </Split>
    </SceneFade>
  )
}

// ---------------------------------------------------------------- Performance
const Kpi: React.FC<{ label: string; value: string; delay: number }> = ({ label, value, delay }) => (
  <Pop delay={delay}>
    <div style={{ background: '#fff', border: '1px solid #e6e9ee', borderRadius: 14, padding: '10px 14px' }}>
      <div style={{ fontSize: 13, color: C.mute }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: C.navy, lineHeight: 1.15 }}>{value}</div>
    </div>
  </Pop>
)

export const PerformanceScene: React.FC<{ duration: number }> = ({ duration }) => {
  const scale = useScale()
  const frame = useCurrentFrame()
  const grow = interpolate(frame, [30, 90], [0, 1], { ...clamp, easing: ease })
  const views = Math.round(interpolate(frame, [20, 90], [0, 1284], { ...clamp, easing: ease }))
  const leads = Math.round(interpolate(frame, [20, 90], [0, 86], { ...clamp, easing: ease }))
  const occ = Math.round(interpolate(frame, [20, 90], [0, 75], { ...clamp, easing: ease }))
  const bars = [30, 50, 40, 75, 60, 100]
  const areas: Array<[string, number]> = [['Bandra', 100], ['Andheri', 72], ['Powai', 58]]
  return (
    <SceneFade duration={duration} bg={`linear-gradient(180deg, ${C.lav}, #fff)`}>
      <Split caption={<Caption title={<>See what is <span style={{ color: C.coral }}>working.</span></>} sub="Views, enquiries, occupancy and rent by area. Know your numbers at a glance." />}>
        <Phone scale={scale}>
          <div style={{ background: C.navy, color: '#fff', padding: '56px 18px 18px' }}>
            <small style={{ opacity: 0.75, fontSize: 13 }}>Performance</small>
            <div style={{ fontSize: 22, fontWeight: 700 }}>Your portfolio</div>
          </div>
          <div style={{ background: '#f6f7f9', position: 'absolute', top: 118, bottom: 74, left: 0, right: 0, padding: 12, display: 'grid', gap: 10, alignContent: 'start' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Kpi label="Page views" value={views.toLocaleString('en-IN')} delay={6} />
              <Kpi label="Calls + WhatsApp" value={String(leads)} delay={12} />
              <Pop delay={18}>
                <div style={{ background: '#fff', border: '1px solid #e6e9ee', borderRadius: 14, padding: '10px 14px', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 46, height: 46, borderRadius: 23, background: `conic-gradient(${C.navy} 0 ${occ}%, #e3e8f0 0)`, display: 'grid', placeItems: 'center' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 15, background: '#fff' }} />
                  </div>
                  <div><div style={{ fontSize: 13, color: C.mute }}>Occupancy</div><b style={{ fontSize: 24, color: C.navy }}>{occ}%</b></div>
                </div>
              </Pop>
              <Kpi label="Rent, rented" value="₹2.4L" delay={24} />
            </div>
            <Pop delay={30}>
              <div style={{ background: '#fff', border: '1px solid #e6e9ee', borderRadius: 14, padding: '10px 14px' }}>
                <b style={{ fontSize: 14 }}>Added per month</b>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 90, marginTop: 8 }}>
                  {bars.map((b, i) => <i key={i} style={{ flex: 1, height: `${b * grow}%`, background: `linear-gradient(180deg,#3d6aa8,${C.navy})`, borderRadius: '4px 4px 0 0' }} />)}
                </div>
              </div>
            </Pop>
            <Pop delay={38}>
              <div style={{ background: '#fff', border: '1px solid #e6e9ee', borderRadius: 14, padding: '10px 14px' }}>
                <b style={{ fontSize: 14 }}>Average rent by area</b>
                {areas.map(([a, w]) => (
                  <div key={a} style={{ display: 'grid', gridTemplateColumns: '70px 1fr', alignItems: 'center', marginTop: 8, fontSize: 13, color: C.mute }}>
                    {a}<i style={{ display: 'block', height: 10, width: `${w * grow}%`, borderRadius: 99, background: 'linear-gradient(90deg,#6aa889,#2f6b4f)' }} />
                  </div>
                ))}
              </div>
            </Pop>
          </div>
          <TabBar active="Performance" />
        </Phone>
      </Split>
    </SceneFade>
  )
}
