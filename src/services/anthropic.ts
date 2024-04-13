import { Message, LLmCompletionPayload, LlmChunk, LlmCompletionOpts, LlmResponse, LlmStream, LlmContentPayload } from '../index.d'
import { Configuration } from '../config.d'
import { store } from './store'
import LlmEngine from './engine'
import Anthropic from '@anthropic-ai/sdk'
import { Stream } from '@anthropic-ai/sdk/streaming'
import { ImageBlockParam, MessageParam, MessageStreamEvent, TextBlockParam } from '@anthropic-ai/sdk/resources'

const visionModels: string[] = []

export default class extends LlmEngine {

  client: Anthropic

  constructor(config: Configuration) {
    super(config)
    this.client = new Anthropic({
      apiKey: config.engines.anthropic?.apiKey
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _isVisionModel(model: string): boolean {
    return true
  }

  getRountingModel(): string|null {
    return null
  }

  async getModels(): Promise<any[]> {
    return [
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
    ]
  }

  async complete(thread: Message[], opts: LlmCompletionOpts): Promise<LlmResponse> {

    // call
    const model = opts?.model || this.config.engines.anthropic.model.chat
    console.log(`[anthropic] prompting model ${model}`)
    const response = await this.client.messages.create({
      model: model,
      system: thread[0].content,
      max_tokens: opts?.maxTokens || 4096,
      messages: this._buildPayload(thread, model),
    });

    // return an object
    return {
      type: 'text',
      content: response.content.toString()
    }
  }

  async stream(thread: Message[], opts: LlmCompletionOpts): Promise<LlmStream> {

    // model: switch to vision if needed
    let model = opts?.model || this.config.engines.anthropic.model.chat
    if (this._requiresVisionModel(thread, model)) {
      const visionModel = this._findModel(store.config.engines.anthropic.models.chat, visionModels)
      if (visionModel) {
        model = visionModel.id
      }
    }
  
    // call
    console.log(`[anthropic] prompting model ${model}`)
    const stream = this.client.messages.create({
      model: model,
      system: thread[0].content,
      max_tokens: opts?.maxTokens || 4096,
      messages: this._buildPayload(thread, model),
      stream: true,
    })

    // done
    return stream

  }

  async stop(stream: Stream<any>) {
    stream.controller.abort()
  }

  streamChunkToLlmChunk(chunk: MessageStreamEvent): LlmChunk|null {
    if (chunk.type == 'message_stop') {
      return { text: '', done: true }
    } else if (chunk.type == 'content_block_delta') {
      return {
        text: chunk.delta.text,
        done: false
      }
    } else {
      return null
    }
  }

  addImageToPayload(message: Message, payload: LLmCompletionPayload) {
    payload.content = [
      { type: 'text', text: message.content },
      { type: 'image', source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: message.attachment.contents,
      }}
    ]
  }

  _buildPayload(thread: Message[], model: string): Array<MessageParam> {
    const payload: LLmCompletionPayload[] = super._buildPayload(thread, model)
    return payload.filter((payload) => payload.role != 'system').map((payload): MessageParam => {
      if (typeof payload.content == 'string') {
        return {
          role: payload.role,
          content: payload.content
        }
      } else {
        return {
          role: payload.role,
          content: payload.content.map((content: LlmContentPayload): TextBlockParam|ImageBlockParam => {
            if (content.type == 'image') {
              return {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: content.source.media_type,
                  data: content.source.data,
                }
              }
            } else {
              return {
                type: 'text',
                text: content.text
              }
            }
          })
        }
      }
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async image(prompt: string, opts: LlmCompletionOpts): Promise<LlmResponse|null> {
    return null    
  }
}