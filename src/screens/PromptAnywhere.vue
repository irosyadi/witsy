
<template>
  <div class="anywhere" @mousedown="onMouseDown" @mouseup="onMouseUp">
    <div class="container">
      <ResizableHorizontal :min-width="500" :resize-elems="false" @resize="onPromptResize">
        <Prompt ref="prompt" :chat="chat" placeholder="Ask me anything" menus-position="below" :enable-doc-repo="false" :enable-attachments="true" :enable-experts="true" :enable-commands="false" :enable-conversations="false" />
      </ResizableHorizontal>
      <div class="spacer" />
      <ResizableHorizontal :min-width="500" :resize-elems="false" @resize="onResponseResize" v-if="response">
        <OutputPanel ref="output" :message="response" @close="onClose" @clear="onClear" @chat="onChat"/>
      </ResizableHorizontal>
    </div>
  </div>
</template>

<script setup lang="ts">

import { anyDict } from 'types'
import { Ref, ref, onMounted, onUnmounted } from 'vue'
import { store } from '../services/store'
import { availablePlugins } from '../plugins/plugins'
import { LlmEngine } from 'multi-llm-ts'
import { SendPromptParams } from '../components/Prompt.vue'
import ResizableHorizontal from '../components/ResizableHorizontal.vue'
import LlmFactory from '../llms/llm'
import Prompt from '../components/Prompt.vue'
import OutputPanel from '../components/OutputPanel.vue'
import Generator from '../services/generator'
import Attachment from '../models/attachment'
import Message from '../models/message'
import Chat from '../models/chat'

import useEventBus from '../composables/event_bus'
const { onEvent, emitEvent } = useEventBus()

const promptChatTimeout = 1000 * 60 * 1

// load store
store.load()

// init stuff
const generator = new Generator(store.config)
const llmFactory = new LlmFactory(store.config)

const prompt = ref(null)
const output = ref(null)
const chat: Ref<Chat> = ref(null)
const response: Ref<Message> = ref(null)

const props = defineProps({
  extra: Object
})

type LastViewed = {
  uuid: string,
  when: number,
}

let llm: LlmEngine = null
let addedToHistory = false
let lastSeenChat: LastViewed = null
let mouseDownToClose = false
let userPrompt: string = null
let userEngine: string = null
let userModel: string = null

onMounted(() => {
  
  // events
  onEvent('send-prompt', onSendPrompt)
  onEvent('stop-prompting', onStopGeneration)
  window.api.on('query-params', processQueryParams)
  window.api.on('show', onShow)

  // shotcuts work better at document level
  document.addEventListener('keyup', onKeyUp)
  document.addEventListener('keydown', onKeyDown)  

})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('keyup', onKeyUp)
  window.api.off('query-params', processQueryParams)
  window.api.off('show', onShow)
})

const processQueryParams = (params: anyDict) => {

  // log
  console.log('Processing query params', JSON.stringify(params))

  // reset stuff
  userPrompt = null
  userEngine = null
  userModel = null

  // auto-select prompt
  if (params.promptId) {
    userPrompt = window.api.automation.getText(params.promptId)
    if (userPrompt?.length) {
      console.log(`Triggered with prompt: ${userPrompt.replaceAll('\n', '').substring(0, 50)}...`)
      userEngine = params.engine
      userModel = params.model
    } else {
      console.error(`Prompt with id ${params.promptId} not found`)
    }
  }

  // auto-select expert
  if (params?.foremostApp) {
    for (const expert of store.experts) {
      if (expert.triggerApps?.find((app) => app.identifier == params.foremostApp)) {
        console.log(`Tiggered on ${params.foremostApp}: filling prompt with expert ${expert.name}`)
        setExpert(expert.id)
        break
      }
    }
  }

}

const onShow = () => {

  // if we have a user prompt we start over
  if (userPrompt?.length) {
    chat.value = null
    response.value = null
  }

  // see if chat is not that old
  if (chat.value !== null) {
    if (lastSeenChat == null || lastSeenChat.uuid !== chat.value.uuid || lastSeenChat.when < Date.now() - promptChatTimeout) {
      chat.value = null
    } else {
      if (chat.value.messages.length > 1) {
        response.value = chat.value.lastMessage()
      } else {
        response.value = null
      }
    }
  }

  // should we reinit?
  if (chat.value === null) {
    initChat()
  }

  // init llm
  initLlm()

  // focus prompt
  if (prompt.value) {
    prompt.value.setPrompt(userPrompt || undefined)
    prompt.value.focus()
  }

}

const initChat = () => {

  // init thread
  chat.value = new Chat()
  chat.value.title = null

  // reset stuff
  response.value = null
  addedToHistory = false

}

const initLlm = () => {

  // get engine and model
  let engine = userEngine || store.config.prompt.engine
  let model = userModel || store.config.prompt.model
  if (!engine.length || !model.length) {
    ({ engine, model } = llmFactory.getChatEngineModel(false))
  }

  // log
  console.log(`initialize prompt window llm: ${engine} ${model}`)
  
  // init llm with tools
  llm = llmFactory.igniteEngine(engine)
  for (const pluginName in availablePlugins) {
    const pluginClass = availablePlugins[pluginName]
    const instance = new pluginClass(store.config.plugins[pluginName])
    llm.addPlugin(instance)
  }

  // set engine model
  chat.value.setEngineModel(engine, model)

}

const setExpert = (id: string) => {
  const expert = store.experts.find((p) => p.id == id)
  emitEvent('set-expert', expert || null)
}

const onKeyDown = (ev: KeyboardEvent) => {

  // all this requires we have a response
  if (!response.value) return

  const isCommand = !ev.shiftKey && !ev.altKey && (ev.metaKey || ev.ctrlKey)
  const isShiftCommand = ev.shiftKey && !ev.altKey && (ev.metaKey || ev.ctrlKey)

  // now check
  /*if (isCommand && ev.key == 'x') {
    ev.preventDefault()
    onClear()
  } else if (isCommand && ev.key == 's') {
    ev.preventDefault()
    onChat()
  } else */if (isShiftCommand && ev.key == 's') {
    ev.preventDefault()
    saveChat()
  }

}

const onKeyUp = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    if (prompt.value?.getPrompt()?.length) {
      prompt.value.setPrompt('')
    } else {
      onClose()
    }
  }
}

const onMouseDown = (ev: MouseEvent) => {
  const target = ev.target as HTMLElement
  mouseDownToClose = (target.classList.contains('anywhere') || target.classList.contains('container'))
}

const onMouseUp = (ev: MouseEvent) => {
  if (!mouseDownToClose) return
  const target = ev.target as HTMLElement
  if (target.classList.contains('anywhere') || target.classList.contains('container')) {
    onClose()
  }
}

const cleanUp = () => {
  prompt.value?.setPrompt()
  output.value?.cleanUp()
  response.value = null
}

const onClear = () => {

  // stop generation
  onStopGeneration()

  // reset all messages
  initChat()

  // reset response
  output.value?.cleanUp()
  response.value = null

  // focus prompt
  if (prompt.value) {
    prompt.value.setPrompt()
    prompt.value.focus()
  }

}

const onClose = () => {

  // save last seen chat
  if (chat.value !== null) {
    lastSeenChat = { uuid: chat.value.uuid, when: Date.now() }
  } else {
    lastSeenChat = null
  }

  // cleanup
  cleanUp()

  // // remove listeners
  // document.removeEventListener('keyup', onKeyUp)
  // document.removeEventListener('keydown', onKeyDown)

  // done
  window.api.anywhere.close()
}

const onStopGeneration = () => {
  generator.stop()
}

const onSendPrompt = async (params: SendPromptParams) => {

  try {

    // deconstruct params
    const { prompt, attachment, docrepo, expert } = params
  
    // this should not happen but it happens
    if (chat.value === null) {
      initChat()
      initLlm()
    }
    if (llm === null) {
      initLlm()
    }

    // system instructions
    if (chat.value.messages.length === 0) {
      const systemInstructions = generator.getSystemInstructions()
      chat.value.addMessage(new Message('system', systemInstructions))
    }

    // update thread
    const userMessage = new Message('user', prompt)
    userMessage.expert = expert
    if (attachment) {
      attachment.loadContents()
      userMessage.attach(attachment)
    }
    chat.value.addMessage(userMessage)

    // set response
    response.value = new Message('assistant')
    chat.value.addMessage(response.value)

    // now generate
    await generator.generate(llm, chat.value.messages, {
      model: chat.value.model,
      docrepo: docrepo,
      sources: true,
    })

    // save?
    if (store.config.prompt.autosave) {
      saveChat()
    }

  } catch (err) {
    console.error(err)
    response.value.setText('An error occurred while generating the response.')
  }

}

const saveChat = async () => {

  // we need a title
  if (!chat.value.title) {
    const title = await llm.complete(chat.value.model, [...chat.value.messages, new Message('user', store.config.instructions.titling_user)])
    chat.value.title = title.content
  }

  // add to history
  if (!addedToHistory) {
    store.chats.push(chat.value)
    addedToHistory = true
  }

  // now save
  store.saveHistory()

}

const onChat = async () => {

  // make sure it is saved
  await saveChat()
  
  // continue
  window.api.chat.open(chat.value.uuid)
  onClose()

}

const onPromptResize = (deltaX: number) => {
  window.api.anywhere.resize(deltaX, 0)
}

const onResponseResize= (deltaX: number) => {
  window.api.anywhere.resize(deltaX, 0)
}

</script>

<style>

.anywhere {

  .prompt {

    .input {
      border: none;
      border-radius: 0px;
      background-color: var(--window-bg-color);
      
      .textarea-wrapper {
        textarea {
          max-height: 100px;
          border-radius: 0px;
          background-color: var(--window-bg-color);
          padding: 6px 16px 6px 8px;
          font-size: 16pt;
          &::placeholder {
            opacity: 0.5;
          }
        }

        .icon.left {
          position: static;
          margin: 4px 0px 0px 8px;
          color: var(--text-color);
          
          svg {
            font-size: 14pt;
            height: auto;
          }
        }

        .icon.left + textarea {
          padding-left: 16px;
        }
      }
    }
    
    .icon {
      cursor: pointer;
      margin-top: 4px;
      color: var(--prompt-icon-color);
      font-size: 14pt;
    }

    .icon.send, .icon.stop {
      display: none;
    }
  }

}

</style>

<style scoped>

.anywhere {
  height: 100vh;
  padding-left: 64px;
  padding-right: 64px;
  overflow: hidden;
  background-color: transparent;
}

.container {

  --border-radius: 16px;
  
  display: flex;
  height: 100%;
  flex-direction: column;
  justify-content: start;
  align-items: stretch;

  .prompt {
    -webkit-app-region: drag;
    box-shadow: var(--window-box-shadow);
    background-color: var(--window-bg-color);
    border-radius: var(--border-radius);
    resize: horizontal;
    padding: 10px 16px;
  }

  .prompt * {
    -webkit-app-region: no-drag;
  }

  /* this is to have space between prompt and response */
  /* that does not close the window if clicked */
  .spacer {
    flex: 0 0 32px;
  }

}

</style>
