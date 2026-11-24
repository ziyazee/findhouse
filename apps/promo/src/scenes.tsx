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
  WaHeader,
  WaInput,
  ease,
  photo,
  usePop,
  useVertical,
} from './ui'

const useScale = () => (useVertical() ? 1.4 : 1.12)

// ---------------------------------------------------------------- 1. Pain
export const PainScene: React.FC<{ duration: number }> = ({ duration }) => {
  const scale = useScale()
  const frame = useCurrentFrame()
  const msgs = ['Is this still available?', 'Send photos please', 'What is the rent?', 'Which floor?', 'Send location also', 'Any video?']
  const count = Math.min(msgs.length, Math.floor(Math.max(0, frame - 25) / 14) + 1)
  const badge = Math.min(24, Math.floor(Math.max(0, frame - 20) / 4))
  return (
    <SceneFade duration={duration} bg={`linear-gradient(180deg, ${C.peach}, #fff)`}>
      <Split caption={<Caption title={<>Every listing means the same <span style={{ color: C.coral }}>copy-paste.</span></>} sub="Photos, rent, floor, location. Again and again, for every client." />}>
        <Phone scale={scale}>
          <div style={{ background: '#075e54', color: '#fff', padding: '54px 18px 14px', fontWeight: 700, fontSize: 20, display: 'flex', justifyContent: 'space-between' }}>
            <span>WhatsApp</span>
            <span style={{ background: C.coral, borderRadius: 99, padding: '2px 12px', fontSize: 16 }}>{badge} unread</span>
          </div>
          <div style={{ background: '#e7ddd3', position: 'absolute', top: 108, bottom: 0, left: 0, right: 0, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {msgs.slice(0, count).map((m, i) => (
              <Pop key={m} delay={25 + i * 14} from="left" style={{ alignSelf: 'flex-start' }}>
                <Bubble time={`10:${30 + i}`}>{m}</Bubble>
              </Pop>
            ))}
          </div>
        </Phone>
      </Split>
    </SceneFade>
  )
}

// ---------------------------------------------------------------- 2. Send
const NOTE = '2 BHK in Andheri West, semi-furnished, 3rd floor, 850 sq ft. Rent 47,000. Deposit 2 lakh.'

export const SendScene: React.FC<{ duration: number }> = ({ duration }) => {
  const scale = useScale()
  const frame = useCurrentFrame()
  const typed = NOTE.slice(0, Math.floor(interpolate(frame, [35, 100], [0, NOTE.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })))
  const ring = interpolate(frame, [125, 150], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <SceneFade duration={duration} bg={`linear-gradient(180deg, ${C.sky}, #fff)`}>
      <Split caption={<Caption title={<>Send details. Say <span style={{ color: C.coral }}>“done”.</span></>} sub="Photos, videos and one short note, on WhatsApp." />}>
        <Phone scale={scale}>
          <WaHeader />
          <WaBody>
            <Pop delay={10} from="right" style={{ alignSelf: 'flex-end', width: '66%' }}>
              <div style={{ background: '#d9fdd3', borderRadius: 10, padding: 4, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                {['living', 'bedroom', 'kitchen'].map((n) => (
                  <div key={n} style={{ aspectRatio: '1.1', borderRadius: 6, background: `url(${photo(n)}) center/cover` }} />
                ))}
                <div style={{ aspectRatio: '1.1', borderRadius: 6, background: 'linear-gradient(135deg,#6f7f8f,#44525f)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 24 }}>+5</div>
              </div>
            </Pop>
            {frame >= 35 && (
              <Bubble out ticks={frame > 110} time="10:41">
                {typed}
              </Bubble>
            )}
            {frame >= 120 && (
              <Pop delay={120} from="right" style={{ alignSelf: 'flex-end' }}>
                <Bubble out ticks time="10:42" style={{ fontWeight: 700, fontSize: 24, padding: '10px 26px', boxShadow: `0 0 0 ${2 + ring * 8}px rgba(232,116,90,${0.9 - ring * 0.6})` }}>
                  done
                </Bubble>
              </Pop>
            )}
          </WaBody>
          <WaInput />
        </Phone>
      </Split>
    </SceneFade>
  )
}

// ---------------------------------------------------------------- 3. Link back
const ROOMS = ['🛋 Living room 3', '🛏 Bedroom 2', '🍳 Kitchen 2', '🚿 Bathroom 1', '🏢 Exterior 1']

export const LinkScene: React.FC<{ duration: number }> = ({ duration }) => {
  const scale = useScale()
  const frame = useCurrentFrame()
  const secs = Math.round(interpolate(frame, [8, 55], [0, 20], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease }))
  const timerPop = usePop(4)
  return (
    <SceneFade duration={duration} bg={`linear-gradient(180deg, ${C.lav}, #fff)`}>
      <Split caption={<Caption title={<>Your listing is back in <span style={{ color: C.coral }}>20 seconds.</span></>} sub="Photos sorted by room. Details written for you. One link to share." />}>
        <div style={{ position: 'relative' }}>
          <Phone scale={scale}>
            <WaHeader />
            <WaBody>
              <Bubble out ticks time="10:42" style={{ fontWeight: 700 }}>done</Bubble>
              {frame < 58 && (
                <Pop delay={5} from="left" style={{ alignSelf: 'flex-start' }}>
                  <div style={{ background: '#fff', borderRadius: 10, padding: '8px 14px', fontSize: 16, color: '#667' }}>⏱ Building your listing…</div>
                </Pop>
              )}
              {frame >= 58 && (
                <Pop delay={58} from="left" style={{ alignSelf: 'flex-start', maxWidth: '90%' }}>
                  <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 1px rgba(0,0,0,.12)' }}>
                    <div style={{ height: 130, background: `url(${photo('exterior')}) center 30%/cover`, position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 10, top: 10, background: '#fff', color: C.navy, fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>For rent</span>
                    </div>
                    <div style={{ padding: '10px 14px 4px', fontSize: 17, lineHeight: 1.3 }}>
                      <b style={{ display: 'block' }}>2 BHK in Andheri West</b>
                      <span style={{ color: '#667' }}>₹47,000 a month</span>
                    </div>
                    <div style={{ color: '#1a73e8', fontSize: 14, padding: '0 14px 12px' }}>ravi-homes.findhouse.in/k3f9x2ab</div>
                  </div>
                </Pop>
              )}
              {frame >= 80 && (
                <Pop delay={80} from="left" style={{ alignSelf: 'flex-start', maxWidth: '94%' }}>
                  <Bubble time="10:42" style={{ fontSize: 15, maxWidth: '100%' }}>
                    ✅ <b>Your listing is ready</b>
                    <br />9 photos sorted by room:
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                      {ROOMS.map((r, i) => (
                        <Pop key={r} delay={88 + i * 6}>
                          <span style={{ background: '#f1f6f2', borderRadius: 99, padding: '2px 10px', fontSize: 13, color: '#234' }}>{r}</span>
                        </Pop>
                      ))}
                    </div>
                  </Bubble>
                </Pop>
              )}
            </WaBody>
            <WaInput />
          </Phone>
          <div
            style={{
              position: 'absolute',
              top: 40,
              right: -40,
              opacity: Math.min(1, timerPop),
              transform: `scale(${0.8 + 0.2 * timerPop})`,
              background: C.navy,
              color: '#fff',
              borderRadius: 99,
              padding: '14px 28px',
              fontSize: 40,
              fontWeight: 700,
              boxShadow: '0 16px 30px rgba(6,34,71,.35)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            ⚡ 00:{String(secs).padStart(2, '0')}
          </div>
        </div>
      </Split>
    </SceneFade>
  )
}

// ---------------------------------------------------------------- 4. Site
const Tile: React.FC<{ img: string; label: string; h: number; more?: string }> = ({ img, label, h, more }) => (
  <div style={{ position: 'relative', flex: 1, height: h, borderRadius: 10, overflow: 'hidden', background: `url(${photo(img)}) center/cover` }}>
    {more ? (
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,34,71,.62)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 26, fontWeight: 700 }}>{more}</div>
    ) : (
      <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(255,255,255,.92)', padding: '3px 8px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>{label}</span>
    )}
  </div>
)

export const SiteScene: React.FC<{ duration: number }> = ({ duration }) => {
  const scale = useScale()
  const frame = useCurrentFrame()
  const scroll = interpolate(frame, [60, 140], [0, 470], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease })
  const barPop = usePop(40)
  return (
    <SceneFade duration={duration} bg={`linear-gradient(180deg, ${C.mint}, #fff)`}>
      <Split caption={<Caption title={<>Your name. Your address. <span style={{ color: C.coral }}>Your website.</span></>} sub="Customers open a clean property page on your own subdomain." />}>
        <Phone scale={scale}>
          {/* scrolling content */}
          <div style={{ position: 'absolute', top: 88, left: 0, right: 0, transform: `translateY(${-scroll}px)` }}>
            <div style={{ position: 'relative', height: 380, background: `#0f2944 url(${photo('exterior')}) center 35%/cover`, color: '#fff' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg,rgba(6,34,71,.96) 0%,rgba(6,34,71,.7) 25%,rgba(6,34,71,0) 64%)' }} />
              <div style={{ position: 'absolute', left: 16, right: 16, bottom: 82 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <span style={{ background: '#fff', color: C.navy, height: 28, padding: '0 12px', borderRadius: 99, fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', display: 'grid', placeItems: 'center' }}>For rent</span>
                  <span style={{ border: '1px solid rgba(255,255,255,.4)', height: 28, padding: '0 12px', borderRadius: 99, fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', display: 'grid', placeItems: 'center' }}>Apartment</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.12, letterSpacing: '-.025em' }}>2 BHK in Andheri West</div>
                <div style={{ marginTop: 8, fontSize: 14, opacity: 0.9 }}>📍 Andheri West, Mumbai</div>
              </div>
            </div>
            <div style={{ position: 'relative', margin: '-56px 16px 0', padding: 22, borderRadius: 28, background: '#fff', boxShadow: '0 24px 48px -28px rgba(10,20,40,.45)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b7280' }}>Monthly rent</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: C.navy, letterSpacing: '-.03em' }}>₹47,000<small style={{ fontSize: 16, color: '#6b7280', fontWeight: 500 }}> /month</small></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {['₹2,00,000 deposit', '+ ₹3,000 maintenance', 'Available now'].map((t) => (
                  <span key={t} style={{ padding: '5px 11px', borderRadius: 99, background: '#e8edf5', color: C.navy, fontSize: 13, fontWeight: 600 }}>{t}</span>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 14, marginTop: 18, paddingTop: 16, borderTop: '1px solid #e6e9ee' }}>
                {[['2 BHK', 'Bedrooms'], ['2', 'Bathrooms'], ['850 sq ft', 'Built-up area'], ['Semi-furnished', 'Furnishing']].map(([v, l]) => (
                  <div key={l}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{v}</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: '30px 16px 120px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <b style={{ fontSize: 18, fontWeight: 600 }}>Gallery</b>
                <span style={{ fontSize: 13, color: '#6b7280' }}>8 photos · 1 video</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {['All 9', 'Living room 3', 'Bedroom 2'].map((t, i) => (
                  <span key={t} style={{ height: 38, padding: '0 14px', borderRadius: 99, display: 'grid', placeItems: 'center', fontSize: 14, border: '1px solid #d2d8e0', background: i === 0 ? C.navy : '#fff', color: i === 0 ? '#fff' : C.ink }}>{t}</span>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 6 }}><Tile img="living" label="Living room" h={130} /><Tile img="bedroom" label="Bedroom" h={130} /></div>
                <div style={{ display: 'flex', gap: 6 }}><Tile img="kitchen" label="Kitchen" h={90} /><Tile img="bathroom" label="Bathroom" h={90} /><Tile img="exterior" label="" h={90} more="+4" /></div>
              </div>
            </div>
          </div>
          {/* fixed url bar */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 88, background: '#f1f3f6', borderBottom: '1px solid #e1e5ea', padding: '46px 14px 0', zIndex: 10 }}>
            <div style={{ height: 34, background: '#fff', border: '1px solid #dde2e8', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', fontSize: 14, whiteSpace: 'nowrap' }}>
              🔒 <span><b style={{ color: '#2f6b4f' }}>ravi-homes</b>.findhouse.in/k3f9x2ab</span>
            </div>
          </div>
          {/* contact bar */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '12px 16px 28px', background: 'rgba(255,255,255,.92)', borderTop: '1px solid rgba(28,36,48,.08)', display: 'flex', gap: 10, zIndex: 10, transform: `translateY(${(1 - barPop) * 120}px)` }}>
            <div style={{ flex: 1, height: 52, borderRadius: 16, background: C.navy, color: '#fff', fontWeight: 700, fontSize: 15, display: 'grid', placeItems: 'center' }}>📞 Call</div>
            <div style={{ flex: 1, height: 52, borderRadius: 16, background: '#1fa855', color: '#fff', fontWeight: 700, fontSize: 15, display: 'grid', placeItems: 'center' }}>WhatsApp</div>
          </div>
        </Phone>
      </Split>
    </SceneFade>
  )
}

// ---------------------------------------------------------------- 5. Private
const MiniPhone: React.FC<{ scale: number; url: string; children: React.ReactNode }> = ({ scale, url, children }) => (
  <Phone scale={scale}>
    <div style={{ background: '#f1f3f6', padding: '46px 14px 10px', borderBottom: '1px solid #e1e5ea' }}>
      <div style={{ background: '#fff', border: '1px solid #dde2e8', borderRadius: 99, padding: '7px 14px', fontSize: 14, whiteSpace: 'nowrap' }}>{url}</div>
    </div>
    {children}
  </Phone>
)

const Card: React.FC<{ img: string; price: string; t: string }> = ({ img, price, t }) => (
  <div style={{ background: '#fff', border: '1px solid #e6e9ee', borderRadius: 12, overflow: 'hidden' }}>
    <div style={{ height: 120, background: `url(${photo(img)}) center/cover` }} />
    <div style={{ padding: '8px 12px', fontSize: 14 }}>
      <b style={{ color: C.navy, fontSize: 17 }}>{price}</b> {t}
    </div>
  </div>
)

export const PrivateScene: React.FC<{ duration: number }> = ({ duration }) => {
  const vertical = useVertical()
  const frame = useCurrentFrame()
  const scale = vertical ? 1.0 : 0.95
  const flip = interpolate(frame, [45, 58], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const isPrivate = flip >= 0.5
  return (
    <SceneFade duration={duration} bg={`linear-gradient(180deg, ${C.peach}, #fff)`}>
      <Split caption={<Caption title={<>Public or <span style={{ color: C.coral }}>private.</span> You choose.</>} sub="Flip any home private. It leaves your front page, but you can still share it with one customer by link." />}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
        <Pop delay={2}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, background: '#fff', borderRadius: 99, padding: '12px 30px', boxShadow: '0 12px 30px rgba(6,34,71,.15)', fontSize: 32, fontWeight: 700, color: C.navy }}>
            <span style={{ opacity: isPrivate ? 0.4 : 1 }}>🌐 Public</span>
            <div style={{ width: 96, height: 48, borderRadius: 99, background: isPrivate ? '#9a5b13' : '#2f6b4f', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 5, left: 5 + flip * 48, width: 38, height: 38, borderRadius: 19, background: '#fff' }} />
            </div>
            <span style={{ opacity: isPrivate ? 1 : 0.4 }}>🔒 Private</span>
          </div>
        </Pop>
        <div style={{ display: 'flex', gap: vertical ? 24 : 50 }}>
          <Pop delay={6} from="left">
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-block', background: '#edf3ee', color: '#2f6b4f', border: '1px solid #c9dccf', borderRadius: 99, padding: '6px 20px', fontWeight: 700, fontSize: 24, marginBottom: 14 }}>🌐 Front page</div>
              <MiniPhone scale={scale} url="ravi-homes.findhouse.in">
                <div style={{ background: C.navy, color: '#fff', padding: 12, textAlign: 'center', fontWeight: 700, fontSize: 18 }}>Ravi Homes<div style={{ fontSize: 12, fontWeight: 400, opacity: 0.8 }}>2 homes available</div></div>
                <div style={{ padding: 12, display: 'grid', gap: 10, background: '#f6f7f9', height: 560 }}>
                  <Card img="living" price="₹47,000/mo" t="2 BHK, Andheri" />
                  <Card img="bedroom" price="₹38,000/mo" t="2 BHK, Powai" />
                  {isPrivate ? (
                    <div style={{ border: '1.5px dashed #c3cad6', borderRadius: 10, padding: 12, textAlign: 'center', color: '#8a94a4', fontSize: 14 }}>🔒 Private home<br />not shown here</div>
                  ) : (
                    <Card img="exterior" price="₹95,000/mo" t="3 BHK, Bandra" />
                  )}
                </div>
              </MiniPhone>
            </div>
          </Pop>
          <Pop delay={22} from="right">
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-block', background: '#fbf5ea', color: '#9a5b13', border: '1px solid #ecd9b5', borderRadius: 99, padding: '6px 20px', fontWeight: 700, fontSize: 24, marginBottom: 14 }}>🔒 Shared by link</div>
              <MiniPhone scale={scale} url="ravi-homes.findhouse.in/q8m2…">
                <div style={{ height: 230, background: `#355 url(${photo('exterior')}) center 60%/cover`, position: 'relative', color: '#fff' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg,rgba(6,34,71,.9),rgba(6,34,71,0) 70%)' }} />
                  <span style={{ position: 'absolute', right: 12, top: 12, background: 'rgba(255,255,255,.92)', color: C.navy, fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 99 }}>🔒 Private</span>
                  <div style={{ position: 'absolute', left: 14, bottom: 12, fontWeight: 700, fontSize: 22 }}><small style={{ display: 'block', fontSize: 12, fontWeight: 500 }}>For rent · Villa</small>3 BHK in Bandra</div>
                </div>
                <div style={{ padding: 16 }}>
                  <div style={{ fontSize: 30, fontWeight: 700, color: C.navy }}>₹95,000 <small style={{ fontSize: 14, color: C.mute, fontWeight: 500 }}>/ month</small></div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', textAlign: 'center', border: '1px solid #e6e9ee', borderRadius: 12, padding: '10px 0', marginTop: 14, fontSize: 12, color: C.mute }}>
                    {[['3', 'Beds'], ['3', 'Baths'], ['1400', 'sq ft'], ['Full', 'Furn.']].map(([v, l]) => (
                      <div key={l}><b style={{ display: 'block', fontSize: 17, color: C.ink }}>{v}</b>{l}</div>
                    ))}
                  </div>
                </div>
              </MiniPhone>
            </div>
          </Pop>
        </div>
        </div>
      </Split>
    </SceneFade>
  )
}

// ---------------------------------------------------------------- 6. Close
const HOUSE = (
  <svg viewBox="0 0 220 180" style={{ width: '100%', height: 'auto' }}>
    <ellipse cx="110" cy="160" rx="92" ry="12" fill="rgba(0,0,0,.25)" />
    <rect x="14" y="116" width="192" height="36" rx="14" fill="#86bd98" />
    <rect x="14" y="110" width="192" height="30" rx="14" fill="#bfe3c9" stroke="#062247" strokeWidth="2.4" />
    <path d="M96 140 L124 140 L134 120 L86 120 Z" fill="#f3e5cf" stroke="#062247" strokeWidth="2" strokeLinejoin="round" />
    <rect x="39" y="92" width="6" height="20" rx="2" fill="#8a5a3c" stroke="#062247" strokeWidth="2" />
    <circle cx="42" cy="82" r="19" fill="#4f9d72" stroke="#062247" strokeWidth="2.4" />
    <rect x="68" y="68" width="88" height="54" rx="4" fill="#fff6e8" stroke="#062247" strokeWidth="2.6" />
    <rect x="128" y="34" width="14" height="24" rx="2" fill="#c95f47" stroke="#062247" strokeWidth="2.4" />
    <path d="M58 72 L112 26 L166 72 Z" fill="#e8745a" stroke="#062247" strokeWidth="2.6" strokeLinejoin="round" />
    <path d="M100 122 V98 a12 12 0 0 1 24 0 V122 Z" fill="#062247" />
    <circle cx="119" cy="111" r="1.8" fill="#ffd27a" />
    <rect x="75" y="82" width="18" height="16" rx="2" fill="#bfe0f5" stroke="#062247" strokeWidth="2.2" />
    <rect x="131" y="82" width="18" height="16" rx="2" fill="#bfe0f5" stroke="#062247" strokeWidth="2.2" />
    <circle cx="112" cy="56" r="6" fill="#bfe0f5" stroke="#062247" strokeWidth="2" />
    <rect x="181" y="92" width="3" height="24" fill="#062247" />
    <rect x="170" y="80" width="28" height="15" rx="3.5" fill="#fff" stroke="#062247" strokeWidth="2.2" />
    <text x="184" y="91" fontFamily="DM Sans, sans-serif" fontSize="8" fontWeight="700" fill="#e8745a" textAnchor="middle">RENT</text>
    <circle cx="70" cy="126" r="8" fill="#6dbb8b" stroke="#062247" strokeWidth="2" />
    <circle cx="154" cy="127" r="7" fill="#6dbb8b" stroke="#062247" strokeWidth="2" />
  </svg>
)

export const CloseScene: React.FC<{ duration: number }> = ({ duration }) => {
  const vertical = useVertical()
  const bob = Math.sin(useCurrentFrame() / 14) * 6
  return (
    <SceneFade duration={duration} bg={`radial-gradient(1200px 800px at 15% 90%, rgba(157,192,255,.25), transparent 60%), linear-gradient(170deg,#0f3d80 0%,${C.navy} 58%,#031430 100%)`}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: vertical ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: vertical ? 40 : 70, padding: vertical ? '120px 70px' : '0 120px' }}>
        <div style={{ textAlign: vertical ? 'center' : 'left', flex: 'none' }}>
          <Pop>
            <div style={{ display: 'flex', alignItems: 'center', gap: 22, justifyContent: vertical ? 'center' : 'flex-start', marginBottom: 40 }}>
              <img src={staticFile('logo-mark.png')} style={{ width: 96, height: 96, borderRadius: 26, background: '#fff', padding: 9 }} />
              <span style={{ fontSize: 64, fontWeight: 700, color: '#fff' }}>FindHouse</span>
            </div>
          </Pop>
          <Caption align={vertical ? 'center' : 'left'} color="#fff" title={<>Are you ready to start? <span style={{ color: '#ffb59f' }}>List your next property.</span></>} sub="Send it on WhatsApp. We’ll do the rest." />
          <Pop delay={30}>
            <div style={{ marginTop: 44, display: 'inline-flex', flexDirection: 'column', gap: 18, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.28)', borderRadius: 32, padding: '28px 40px', textAlign: 'left' }}>
              <div style={{ fontSize: 26, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)', fontWeight: 700 }}>Contact FindHouse</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, color: '#fff', fontSize: 42, fontWeight: 700, whiteSpace: 'nowrap' }}>
                <span style={{ width: 64, height: 64, borderRadius: 20, background: '#1fa855', display: 'grid', placeItems: 'center', fontSize: 34 }}>💬</span>
                Message us on WhatsApp
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, color: '#fff', fontSize: 42, fontWeight: 700, whiteSpace: 'nowrap' }}>
                <span style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(255,255,255,.18)', display: 'grid', placeItems: 'center', fontSize: 34 }}>🌐</span>
                findhouse.in
              </div>
            </div>
          </Pop>
        </div>
        <Pop delay={14}>
          <div style={{ width: vertical ? 620 : 480, transform: `translateY(${bob}px)` }}>{HOUSE}</div>
        </Pop>
      </div>
    </SceneFade>
  )
}
