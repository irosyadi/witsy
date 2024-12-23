
import { Store } from 'types/index.d'
import Dialog from './dialog'

export type TipId = 'scratchpad' | 'conversation' | 'computerUse' | 'newPrompt' | 'newCommand'

class TipsManager {

  store: Store

  constructor(store: Store) {
    this.store = store
  }

  isTipAvailable = (tip: TipId) => {
    return this.store.config.general.tips[tip]
  }

  setTipShown = (tip: TipId) => {
    this.store.config.general.tips[tip] = false
    this.store.saveSettings()
  }

  showNextTip = () => {

    // not on 1st run
    if (this.store.config.general.firstRun) {
      this.store.config.general.firstRun = false
      this.store.saveSettings()
      return
    }

    const tipsToShow: TipId[] = [ 'scratchpad', 'newPrompt' ]

    for (const tip of tipsToShow) {
      const shouldShow = this.store.config.general.tips[tip]
      if (shouldShow) {
        this.showTip(tip)
        return
      }
    }

  }

  showTip = (tip: TipId) => {

    // callbacks
    const callbacks: { [key: string]: CallableFunction } = {
      'scratchpad': this.showScratchpadTip,
      'conversation': this.showConversationTip,
      'computerUse': this.showComputerUseWarning,
      'newPrompt': this.showNewPromptTip,
      'newCommand': this.showNewCommandTip,
    }

    // get the callback
    const callback = callbacks[tip]
    if (!callback) {
      console.error(`Unknown tip: ${tip}`)
      return
    }

    // call and done
    this.setTipShown(tip)
    callback()

  }

  showScratchpadTip = () => {
    Dialog.show({
      title: 'Witsy now includes an interactive scratchpad leveraging Generative AI to help you write the best content!',
      text: 'Do you want to check it now? It is available in the Witsy menu when you need it!',
      confirmButtonText: 'Yes!',
      cancelButtonText: 'Later',
      showCancelButton: true,
    }).then((result: any) => {
      if (result.isConfirmed) {
        window.api.scratchpad.open()
      }
    })
  
  }

  showConversationTip = () => {
    Dialog.show({
      title: 'Check the conversation options by right-clicking on the microphone icon in the chat window.',
    })
  }

  showComputerUseWarning = () => {
    Dialog.show({
      title: 'Computer Use will interact with your computer and perform mouse and keyboard actions. These actions may cause unexpected behavior which could result in data loss.',
      text: 'Use at your own risk!',
    })
  }

  showNewPromptTip = () => {
    Dialog.show({
      title: 'The Prompt Anywhere feature has been completely redesigned and gives you faster than ever to Generative AI!',
      text: 'Do you want to check it now? It is available in the Witsy menu when you need it!',
      confirmButtonText: 'Yes!',
      cancelButtonText: 'Later',
      showCancelButton: true,
    }).then((result: any) => {
      if (result.isConfirmed) {
        window.api.anywhere.prompt()
      }
    })
  
  }

  showNewCommandTip = () => {
    Dialog.show({
      title: 'The AI Command feature has been completely redesigned and gives you more flexibility than ever!',
      text: 'Replace, Insert and other commands are available at the bottom of the response window.',
      confirmButtonText: 'Got it!',
    })
  }

}

export default function useTipsManager(store: Store) {
  return new TipsManager(store)
}
