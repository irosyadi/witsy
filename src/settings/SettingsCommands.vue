
<template>
  <div class="content" @click="closeContextMenu">
    <div class="commands">
      <table>
        <thead>
          <tr>
            <th v-for="column in columns" :key="column.field">{{ column.title }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="command in visibleCommands" :key="command.id" :data-id="command.id" class="command" :class="selected?.id == command.id ? 'selected' : ''"
              @click="onSelect(command)" @dblclick="onEdit(command)" draggable="true" @dragstart="onDragStart" @dragover="onDragOver" @dragend="onDragEnd"
          >
            <td class="enabled"><input type="checkbox" :checked="command.state=='enabled'" @click="onEnabled(command)" /></td>
            <td class="icon">{{ command.icon }}</td>
            <td class="label">{{ command.label }}</td>
            <td class="shortcut">{{ command.shortcut }}</td>
            <td class="action">{{ action(command.action) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="actions">
      <button @click.prevent="onNew">New</button>
      <button @click.prevent="onEdit(selected)" :disabled="!selected">Edit</button>
      <button @click.prevent="onDelete" :disabled="!selected">Delete</button>
      <div class="right">
        <button @click.prevent.stop="onMore" ref="moreButton">More {{ showMenu ? '▼' : '▲'}}</button>
      </div>
    </div>
    <ContextMenu v-if="showMenu" :on-close="closeContextMenu" :actions="contextMenuActions" @action-clicked="handleActionClick" :x="menuX" :y="menuY" align="bottom-right" :teleport="false" />
    <CommandDefaults id="defaults" ref="defaults" @command-defaults-modified="onCommandModified"/>
    <CommandEditor id="command-editor" :command="edited" @command-modified="onCommandModified"/>
  </div>
</template>

<script setup>

import Swal from 'sweetalert2/dist/sweetalert2.js'
import { v4 as uuidv4 } from 'uuid'
import { ref, computed } from 'vue'
import { store } from '../services/store'
import { newCommand, saveCommands } from '../services/commands'
import CommandDefaults from '../screens/CommandDefaults.vue'
import CommandEditor from '../screens/CommandEditor.vue'
import ContextMenu from '../components/ContextMenu.vue'

const commands = ref(null)
const selected = ref(null)
const edited = ref(null)
const defaults = ref(null)

const moreButton = ref(null)
const showMenu = ref(false)
const menuX = ref(0)
const menuY = ref(0)

const contextMenuActions = [
  { label: 'Defaults', action: 'defaults' },
  { label: 'Export', action: 'export' },
  { label: 'Import', action: 'import' },
]

const visibleCommands = computed(() => commands.value?.filter(command => command.state != 'deleted'))

const columns = [
  { field: 'enabled', title: '' },
  { field: 'icon', title: 'Icon' },
  { field: 'label', title: 'Name', },
  { field: 'shortcut', title: 'Shortcut', },
  { field: 'action', title: 'Action', },
]

const action = (action) => {
  if (action == 'chat_window') return 'Chat Window'
  if (action == 'paste_below') return 'Insert Below'
  if (action == 'paste_in_place') return 'Replace Selection'
  if (action == 'clipboard_copy') return 'Copy to Clipboard'
}

const onMore = (event) => {
  if (showMenu.value) {
    closeContextMenu()
  } else {
    showContextMenu(event)
  }
}

const showContextMenu = () => {
  showMenu.value = true
  const rcButton = moreButton.value.getBoundingClientRect()
  const rcDialog = document.getElementsByTagName('dialog')[0].getBoundingClientRect()
  menuX.value = rcDialog.right - rcButton.right
  menuY.value = rcDialog.bottom - rcButton.bottom + rcButton.height
}

const closeContextMenu = () => {
  showMenu.value = false;
}

const handleActionClick = async (action) => {

  // close
  closeContextMenu()

  // process
  if (action === 'defaults') {
    onDefaults()
  } else if (action === 'import') {
    onImport()
  } else if (action === 'export') {
    onExport()
  }

}

const onDefaults = () => {
  defaults.value.load()
  document.getElementById('defaults').showModal()
}

const onImport = () => {
  if (window.api.commands.import()) {
    store.loadCommands()
    load()
    alert('Commands file imported successfully')
  } else {
    alert('Failed to import commands file')
  }
}

const onExport = () => {
  if (window.api.commands.export()) {
    alert('Commands file exported successfully')
  } else {
    alert('Failed to export commands file')
  }
}

const onSelect = (command) => {
  selected.value = command
}

const onNew = () => {
  selected.value = null
  edited.value = newCommand()
  document.getElementById('command-editor').showModal()
}

const onEdit = (command) => {
  edited.value = command
  selected.value = command
  document.getElementById('command-editor').showModal()
}

const onDelete = () => {
  Swal.fire({
    target: document.querySelector('.settings .commands'),
    title: 'Are you sure you want to delete this command? This cannot be undone.',
    confirmButtonText: 'Delete',
    showCancelButton: true,
  }).then((result) => {
    if (result.isConfirmed) {
      if (selected.value.type == 'system') {
        selected.value.state = 'deleted'
      } else {
        const index = commands.value.indexOf(selected.value)
        commands.value.splice(index, 1)
      }
      selected.value = null
      save()
    }
  })
}

const onEnabled = (command) => {
  command.state = (command.state == 'enabled' ? 'disabled' : 'enabled')
  save()
}

const onCommandModified = (payload) => {

  // new command?
  let command = null
  if (payload.id == null) {
    command = newCommand()
    command.id = uuidv4()
    commands.value.push(command)
  } else {
    command = commands.value.find(command => command.id == payload.id)
  }

  // update
  if (command) {

    // single shortcut
    if (payload.shortcut) {
      for (const c of commands.value) {
        if (c.id != command.id && c.shortcut == payload.shortcut) {
          c.shortcut = null
        }
      }
    }

    // now update
    command.label = payload.label
    command.icon = payload.icon
    command.action = payload.action
    command.template = payload.template
    command.shortcut = payload.shortcut
    command.engine = payload.engine
    command.model = payload.model
  }

  // done
  selected.value = command
  save()

}

var draggedRow
const onDragStart = (event) => {
  draggedRow = event.target.closest('tr')
}

const onDragOver = (event) => {
  
  event.preventDefault();
  
  let target = event.target.closest('tr')
  let targetIndex = Array.from(target.parentNode.children).indexOf(target);
  let draggedRowIndex = Array.from(draggedRow.parentNode.children).indexOf(draggedRow);

  // Determine where to place the dragged row
  if (targetIndex > draggedRowIndex) {
    target.after(draggedRow);
  } else {
    target.before(draggedRow);
  }
  
  // reorder array
  const rows = document.querySelectorAll('tr[data-id]');
  const newOrderIds = Array.from(rows).map(row => row.getAttribute('data-id'));
  commands.value.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));

}

const onDragEnd = () => {
  save()
}

const load = () => {
  commands.value = JSON.parse(JSON.stringify(store.commands))
}

const save = () => {
  store.commands = commands.value
  saveCommands()
}

defineExpose({ load })

</script>

<style scoped>
@import '../../css/dialog.css';
</style>

<style scoped>

.content {
  width: 540px !important;
}

.commands {
  height: 200px;
  overflow-y: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  border: 0.5px solid rgba(192, 192, 192, 0.5);
  background-color: white;
  white-space: nowrap;
  font-size: 9.5pt;
  padding: 2px 4px;
}

tr.selected td {
  background-color: var(--highlight-color);
  color: white;
}

th {
  font-size: 9pt;
  font-weight: normal;
  text-align: left;
  position: sticky;
  top: 0;
  z-index: 1;
}

td.icon, td.shortcut {
  text-align: center;
}

.windows td.icon {
  font-family: 'NotoColorEmojiLimited';
  font-size: 9pt;
}

input[type=checkbox] {
  width: 12px;
  height: 12px;
}

.actions {
  margin-top: 8px;
  display: flex;
}

.actions button:first-child {
  margin-left: 0px;
}

.actions .right {
  flex: 1;
  text-align: right;
}

</style>
