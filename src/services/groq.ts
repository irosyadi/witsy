import { Message } from '../types/index.d'
import { LLmCompletionPayload, LlmChunk, LlmCompletionOpts, LlmResponse, LlmStream, LlmEventCallback } from '../types/llm.d'
import { EngineConfig, Configuration } from '../types/config.d'
import LlmEngine from './engine'
import Groq from 'groq-sdk'
import { ChatCompletionChunk } from 'groq-sdk/lib/chat_completions_ext'
import { CompletionCreateParams } from 'groq-sdk/resources/chat'
import { Stream } from 'groq-sdk/lib/streaming'

export const isGroqReady = (engineConfig: EngineConfig): boolean => {
  return engineConfig.apiKey?.length > 0
}

export default class extends LlmEngine {

  client: Groq

  constructor(config: Configuration) {
    super(config)
    this.client = new Groq({
      apiKey: config.engines.groq?.apiKey || '',
      dangerouslyAllowBrowser: true,
    })
  }

  getName(): string {
    return 'groq'
  }

  getVisionModels(): string[] {
    return []
  }

  async getModels(): Promise<any[]> {

    // need an api key
    if (!this.client.apiKey) {
      return null
    }

    // do it
    return [
      { id: 'llama3-8b-8192', name: 'LLaMA3 8b' },
      { id: 'llama3-70b-8192', name: 'LLaMA3 70b' },
      { id: 'llama2-70b-4096', name: 'LLaMA2 70b' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7b' },
      { id: 'gemma-7b-it-32768', name: 'Gemma 7b' },
    ]
  }

  async complete(thread: Message[], opts: LlmCompletionOpts): Promise<LlmResponse> {

    // call
    const model = opts?.model || this.config.engines.groq.model.chat
    console.log(`[Groq] prompting model ${model}`)
    const response = await this.client.chat.completions.create({
      model: model,
      messages: this.buildPayload(thread, model),
    });

    // return an object
    return {
      type: 'text',
      content: response.choices[0].message.content
    }
  }

  async stream(thread: Message[], opts: LlmCompletionOpts): Promise<LlmStream> {

    // model: switch to vision if needed
    const model = this.selectModel(thread, opts?.model || this.getChatModel())
  
    // call
    console.log(`[Groq] prompting model ${model}`)
    const stream = this.client.chat.completions.create({
      model: model,
      messages: this.buildPayload(thread, model),
      stream: true,
    })

    // done
    return stream

  }

  async stop(stream: Stream<any>) {
    stream.controller.abort()
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async streamChunkToLlmChunk(chunk: ChatCompletionChunk, eventCallback: LlmEventCallback): Promise<LlmChunk|null> {
    if (chunk.choices[0].finish_reason == 'stop') {
      return { text: '', done: true }
    } else {
      return {
        text: chunk.choices[0].delta.content,
        done: false
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
  addImageToPayload(message: Message, payload: LLmCompletionPayload) {
  }

  buildPayload(thread: Message[], model: string): Array<CompletionCreateParams.Message> {
    const payload: LLmCompletionPayload[] = super.buildPayload(thread, model)
    return payload.filter((payload) => payload.role != 'system').map((payload): CompletionCreateParams.Message => {
      return {
        role: payload.role,
        content: payload.content
      }
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async image(prompt: string, opts: LlmCompletionOpts): Promise<LlmResponse|null> {
    return null    
  }
}
