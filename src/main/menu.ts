
import { ShortcutsConfig } from 'types/config'
import { App , Menu, shell } from 'electron'
import { shortcutAccelerator } from './shortcuts'

export type MenuCallbacks = { [key: string]: () => void }

const isMac = process.platform === 'darwin'

const template = (app: App, callbacks: MenuCallbacks, shortcuts: ShortcutsConfig) => [
  // { role: 'appMenu' }
  ...(isMac
    ? [{
        label: app.name,
        submenu: [
          { role: 'about' },
          {
            label: 'Check for Updates…',
            click: async () => callbacks.checkForUpdates()
          },
          { type: 'separator' },
          {
            label: 'Settings…',
            accelerator: 'CmdOrCtrl+,',
            click: async () => callbacks.settings()
          },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          {
            label: 'Quit Witsy',
            accelerator: 'CmdOrCtrl+Q',
            click: () => callbacks.quit()
          }
        ]
      }]
    : []),
  // { role: 'fileMenu' }
  {
    label: 'File',
    submenu: [
      {
        label: 'New Chat',
        accelerator: shortcutAccelerator(shortcuts?.chat),
        click: () => callbacks.newChat()
      },
      {
        label: 'Scratch Pad',
        accelerator: shortcutAccelerator(shortcuts?.scratchpad),
        click: () => callbacks.newScratchpad()
      },
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit' }
    ]
  },
  // { role: 'editMenu' }
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      ...(isMac
        ? [
            { role: 'pasteAndMatchStyle' },
            { role: 'delete' },
            { role: 'selectAll' },
          ]
        : [
            { role: 'delete' },
            { type: 'separator' },
            { role: 'selectAll' }
          ])
    ]
  },
  // { role: 'viewMenu' }
  {
    label: 'View',
    submenu: [
      ...process.env.DEBUG ? [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
      ] : [],
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  },
  // { role: 'windowMenu' }
  {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'zoom' },
      ...(isMac
        ? [
            { type: 'separator' },
            { role: 'front' },
            { type: 'separator' },
            { role: 'window' }
          ]
        : [
            { role: 'close' }
          ])
    ]
  },
  {
    role: 'help',
    submenu: [
      {
        label: 'Learn More',
        click: async () => {
          await shell.openExternal('https://github.com/nbonamy/witsy')
        }
      }
    ]
  }
]

export const installMenu = (app: App, callbacks: MenuCallbacks, shortcuts: ShortcutsConfig) => {
  const menu = Menu.buildFromTemplate(template(app, callbacks, shortcuts) as Array<any>)
  Menu.setApplicationMenu(menu)
}
