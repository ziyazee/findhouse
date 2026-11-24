import React from 'react'
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion'
import { FontFace } from './ui'
import { CloseScene, LinkScene, PainScene, PrivateScene, SendScene, SiteScene } from './scenes'
import { IntroScene, ManageScene, PerformanceScene, ShareHappyScene } from './scenes2'
import manifest from '../public/voice/manifest.json'

export const FPS = 30

type SceneDef = { id: string; Component: React.FC<{ duration: number }>; min: number }

// min = minimum frames. If a voice line exists, the scene stretches to fit it.
const SCENES: SceneDef[] = [
  { id: 'intro', Component: IntroScene, min: 180 },
  { id: 'pain', Component: PainScene, min: 120 },
  { id: 'send', Component: SendScene, min: 180 },
  { id: 'link', Component: LinkScene, min: 150 },
  { id: 'site', Component: SiteScene, min: 180 },
  { id: 'share', Component: ShareHappyScene, min: 180 },
  { id: 'manage', Component: ManageScene, min: 210 },
  { id: 'private', Component: PrivateScene, min: 150 },
  { id: 'performance', Component: PerformanceScene, min: 150 },
  { id: 'close', Component: CloseScene, min: 150 },
]

const VOICE_DELAY = 12 // frames: let the scene fade in before speaking
const TAIL = 18 // frames of breathing room after the voice ends

const voices = manifest as Record<string, number>
const sceneFrames = (s: SceneDef) => {
  const sec = voices[s.id]
  return sec ? Math.max(s.min, Math.ceil(sec * FPS) + VOICE_DELAY + TAIL) : s.min
}

export const TOTAL_FRAMES = SCENES.reduce((n, s) => n + sceneFrames(s), 0)

export const Promo: React.FC = () => {
  let from = 0
  return (
    <AbsoluteFill style={{ background: '#fff' }}>
      <FontFace />
      {SCENES.map((s) => {
        const start = from
        const duration = sceneFrames(s)
        from += duration
        return (
          <Sequence key={s.id} from={start} durationInFrames={duration}>
            <s.Component duration={duration} />
            {voices[s.id] ? (
              <Sequence from={VOICE_DELAY}>
                <Audio src={staticFile(`voice/${s.id}.mp3`)} />
              </Sequence>
            ) : null}
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
