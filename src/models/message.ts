
import { ToolCallInfo } from 'types'
import { LlmRole, LlmChunkTool, Message as MessageBase } from 'multi-llm-ts'
import Attachment from './attachment'

export default class Message extends MessageBase {

  uuid: string
  createdAt: number
  type: string
  toolCall?: ToolCallInfo
  declare attachment: Attachment

  constructor(role: LlmRole, content?: string) {
    super(role, content)
    this.uuid = crypto.randomUUID()
    this.createdAt = Date.now()
    this.type = 'text'
    this.toolCall = null
    this.attachment = null
    if (content === undefined) {
      this.setText(null)
    } else if (typeof content === 'string') {
      this.setText(content)
    }
  }

  static fromJson(obj: any): Message {
    const message = new Message(obj.role, obj.content)
    message.uuid = obj.uuid || crypto.randomUUID()
    message.createdAt = obj.createdAt
    message.attachment = obj.attachment ? Attachment.fromJson(obj.attachment) : null
    message.transient = false
    message.toolCall = null
    return message
  }

  setText(text: string) {
    this.content = text || ''
    this.transient = (text == null)
  }

  setImage(url: string) {
    this.type = 'image'
    this.content = url
    this.transient = false
  }

  setToolCall(toolCall: LlmChunkTool) {
    this.toolCall = {
      status: toolCall.done ? null : toolCall.text,
      params: toolCall.call?.params,
      result: toolCall.call?.result
    }
  }

}
