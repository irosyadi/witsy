<template>
  <component :is="currentView" :extra="queryParams" />
</template>

<script setup>

import { ref, computed, onMounted } from 'vue'
import Main from './screens/Main.vue'
import Wait from './screens/Wait.vue'
import Commands from './screens/Commands.vue'
import PromptAnywhere from './screens/PromptAnywhere.vue'
import Experts from './screens/Experts.vue'
import ReadAloud from './screens/ReadAloud.vue'
import Transcribe from './screens/Transcribe.vue'
import ScratchPad from './screens/ScratchPad.vue'

// add platform name
onMounted(() => {

  // platform friendly name
  let platform = {
    'win32': 'windows',
    'darwin': 'macos',
  }[window.api.platform]||'generic'

  // add it everywhere
  window.platform = platform
  document.platform = platform
  document.querySelector('body').classList.add(platform)

})

// routing
const routes = {
  '/': Main,
  '/chat': Main,
  '/wait': Wait,
  '/command': Commands,
  '/prompt': PromptAnywhere,
  '/experts': Experts,
  '/readaloud': ReadAloud,
  '/transcribe': Transcribe,
  '/scratchpad': ScratchPad,
}

const currentPath = ref(window.location.hash)

const currentView = computed(() => {
  //console.log(currentPath.value.slice(1) || '/')
  return routes[currentPath.value.slice(1) || '/']
})

const queryParams = computed(() => {
  const params = new URLSearchParams(window.location.search);
  const queryParams = {};
  for (const [key, value] of params) {
    queryParams[key] = decodeURIComponent(value);
  }
  return queryParams;
})

</script>
