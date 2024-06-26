

import { Configuration } from '../types/config.d'
import { SpeechPlayer } from 'openai-speech-stream-player'
import { store } from '../services/store'
import Tts from '../services/tts'

export type AudioState = 'idle'|'loading'|'playing'
export type AudioStatus = { state: AudioState, uuid: string }
export type AudioStatusListener = (status: AudioStatus) => void

class AudioPlayer {

  config: Configuration
  listeners: AudioStatusListener[]
  player: SpeechPlayer
  state: AudioState
  uuid: string
  
  constructor(config: Configuration) {
    this.config = config
    this.listeners = []
    this.player = null
    this.state = 'idle'
    this.uuid = null
  }

  addListener(listener: AudioStatusListener) {
    this.listeners.push(listener)
  }

  removeListener(listener: AudioStatusListener) {
    this.listeners = this.listeners.filter(l => l !== listener)
  }

  async play(audioEl: HTMLAudioElement, uuid: string, content: string) {

    // if same id is playing, stop
    if (this.uuid == uuid && this.state != 'idle') {
      this.stop()
      return
    }
  
    // if not same message 1st thing is to stop
    if (this.state != 'idle' && uuid != this.uuid) {
      this.stop()
    }
  
    // set status
    this.uuid = uuid
    this.state = 'loading'
    this.emitStatus()
  
    try {
  
      // get the stream
      const tts = new Tts(this.config)
      const response = await tts.synthetize(content)

      // stream it
      this.player = new SpeechPlayer({
        audio: audioEl,
        onPlaying: () => {
          this.uuid = uuid
          this.state = 'playing'
          this.emitStatus()
        },
        //onPause: () => {},
        onChunkEnd: () => {
          this.stop()
        },
        mimeType: 'audio/mpeg',
      })
      await this.player.init()
      this.player.feedWithResponse(response.content)

    } catch (e) {
      console.error(e)
    }
  
  }
  
  stop() {
    try {
      this.player?.pause()
      this.player?.destroy()
    } catch (e) {
      //console.error(e)
    }

    // reset
    this.uuid = null
    this.player = null
    this.state = 'idle'
    this.emitStatus()
  }

  emitStatus() {
    for (const listener of this.listeners) {
      listener?.call(this, {
        state: this.state,
        uuid: this.uuid,
      } as AudioStatus)
    }
  }

}

let instance: AudioPlayer = null
export default function useAudioPlayer() {
  if (!instance) {
    instance = new AudioPlayer(store.config)
  }
  return instance
}
