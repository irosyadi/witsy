
import { vi, beforeAll, beforeEach, expect, test } from 'vitest'
import { useWindowMock, listeners } from '../mocks/window'
import { store } from '../../src/services/store'
import Chat from '../../src/models/chat'
import Message from '../../src/models/message'
import defaultSettings from '../../defaults/settings.json'

const chats = [
  new Chat(),
  new Chat({
    uuid: '123',
    engine: 'engine',
    model: 'model',
    messages: [
      new Message('system', 'Hi'),
      new Message('user', 'Hello')
    ]
  })
]

// to make testing easier
// was trying to use expect.any(String) but it was not working
chats[1].messages[0].uuid = '1'
chats[1].messages[0].createdAt = 0
chats[1].messages[1].uuid = '2'
chats[1].messages[1].createdAt = 0

beforeAll(() => {
  useWindowMock()
  // @ts-expect-error mock
  window.api.history.load = vi.fn(() => chats)
})

beforeEach(() => {
  vi.clearAllMocks()
  listeners.length = 0
})

test('Check atributtes', async () => {
  expect(store.config).toEqual({})
  expect(store.commands).toEqual([])
  expect(store.experts).toEqual([])
  expect(store.chats).toEqual([])
  expect(store.chatFilter).toBe(null)
})

test('Load', async () => {
  store.load()
  expect(window.api.config?.load).toHaveBeenCalled()
  expect(window.api.experts?.load).toHaveBeenCalled()
  expect(window.api.commands?.load).toHaveBeenCalled()
  expect(window.api.history?.load).toHaveBeenCalled()
  expect(store.config).toStrictEqual(defaultSettings)
  expect(store.commands).toHaveLength(5)
  expect(store.experts).toHaveLength(3)
})

test('Save settings', async () => {
  store.load()
  store.saveSettings()
  expect(window.api.config?.save).toHaveBeenCalled()
})

test('Reload settings without changing reference', async () => {
  store.load()
  expect(window.api.config?.load).toHaveBeenCalledTimes(1)
  const backup = store.config
  expect(store.config.llm.engine).toBe('openai')
  expect(store.config.plugins).toBeDefined()
  defaultSettings.llm.engine = 'xai'
  delete defaultSettings.plugins
  listeners[0]('settings')
  expect(window.api.config?.load).toHaveBeenCalledTimes(2)
  expect(store.config).toBe(backup)
  expect(store.config.llm.engine).toBe('xai')
  expect(store.config.plugins).toBeUndefined()
})

test('Load history', async () => {
  store.load()
  expect(store.chats).toHaveLength(2)
  expect(store.chats[0].messages).toHaveLength(0)
  expect(store.chats[1].messages).toHaveLength(2)
})

test('Save history', async () => {
  store.saveHistory()
  expect(window.api.history?.save).toHaveBeenCalledWith([ {
    uuid: '123',
    engine: 'engine',
    model: 'model',
    deleted: false,
    messages: [
      { uuid: '1', createdAt: 0, role: 'system', type: 'text', content: 'Hi', toolCall: null, attachment: null, transient: false },
      { uuid: '2', createdAt: 0, role: 'user', type: 'text', content: 'Hello', toolCall: null, attachment: null, transient: false }
    ]
  }])
})

test('Merge history', async () => {
  store.load()
  expect(store.chats).toHaveLength(2)
  expect(store.chats[1].messages).toHaveLength(2)
  chats.push(new Chat())
  chats[1].messages.push(new Message('user', ''))
  listeners[0]('history')
  expect(store.chats).toHaveLength(3)
  expect(store.chats[1].messages).toHaveLength(3)
  chats.splice(2, 1)
  listeners[0]('history')
  expect(store.chats).toHaveLength(2)
  expect(store.chats[1].messages).toHaveLength(3)
})
