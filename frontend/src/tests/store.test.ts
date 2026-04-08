import { expect, test, describe } from 'vitest'
import { useChatStore } from '../store'

describe('store initialization', () => {
  test('store initializes with one session', () => {
    const state = useChatStore.getState()
    expect(state.sessions.length).toBe(1)
    expect(state.sessions[0].messages[0].role).toBe('assistant')
  })

  test('store has correct initial state', () => {
    const state = useChatStore.getState()
    expect(state.isTyping).toBe(false)
    expect(state.sidebarOpen).toBe(true)
    expect(state.activeSessionId).toBe('session_1')
    expect(state.healthProfile.name).toBe('')
    expect(state.healthProfile.age).toBe('')
    expect(state.healthProfile.gender).toBe('')
    expect(state.healthProfile.location).toBe('')
    expect(state.healthProfile.weight).toBe('')
    expect(state.healthProfile.height).toBe('')
    expect(state.healthProfile.bloodGroup).toBe('')
    expect(state.healthProfile.conditions).toBe('')
    expect(state.healthProfile.allergies).toBe('')
    expect(state.healthProfile.medications).toBe('')
  })
})

describe('session management', () => {
  test('store can create a new session', () => {
    const prevCount = useChatStore.getState().sessions.length
    useChatStore.getState().createSession()
    const state = useChatStore.getState()
    expect(state.sessions.length).toBe(prevCount + 1)
    expect(state.activeSessionId).toBe(state.sessions[state.sessions.length - 1].id)
  })

  test('new session has welcome message', () => {
    useChatStore.getState().createSession()
    const state = useChatStore.getState()
    const newSession = state.sessions[state.sessions.length - 1]
    expect(newSession.messages[0].role).toBe('assistant')
    expect(newSession.title).toBe('New Chat')
  })

  test('store can add message to active session', () => {
    const state = useChatStore.getState()
    const activeId = state.activeSessionId
    const prevMsgCount = state.sessions.find(s => s.id === activeId)!.messages.length
    state.addMessage({ id: 'test_123', role: 'user', content: 'test msg' })
    const updated = useChatStore.getState().sessions.find(s => s.id === activeId)!
    expect(updated.messages.length).toBe(prevMsgCount + 1)
    expect(updated.messages[updated.messages.length - 1].content).toBe('test msg')
  })

  test('first user message sets session title', () => {
    useChatStore.getState().createSession()
    const state = useChatStore.getState()
    const newSessionId = state.sessions[state.sessions.length - 1].id
    state.setActiveSession(newSessionId)
    state.addMessage({ id: 't1', role: 'user', content: 'I have a headache and fever' })
    const updated = useChatStore.getState().sessions.find(s => s.id === newSessionId)!
    expect(updated.title).toBe('I have a headache and fever')
  })

  test('long first message gets truncated for title', () => {
    useChatStore.setState({
      sessions: [{
        id: 'truncate_test',
        title: 'New Chat',
        messages: [{ id: '1', role: 'assistant', content: 'hi' }],
        createdAt: Date.now(),
      }],
      activeSessionId: 'truncate_test',
    })
    useChatStore.getState().addMessage({ id: 't2', role: 'user', content: 'This is a very long message that should be truncated for the session title display' })
    const updated = useChatStore.getState().sessions.find(s => s.id === 'truncate_test')!
    expect(updated.title).toBe('This is a very long message ...')
  })
})

describe('session deletion', () => {
  test('store can delete a session', () => {
    useChatStore.getState().createSession()
    const sessionsBefore = useChatStore.getState().sessions.length
    const activeId = useChatStore.getState().activeSessionId
    useChatStore.getState().deleteSession(activeId)
    expect(useChatStore.getState().sessions.length).toBe(sessionsBefore - 1)
  })

  test('deleting last session creates a new one', () => {
    useChatStore.setState({
      sessions: [{
        id: 'only_one',
        title: 'Only Chat',
        messages: [{ id: '1', role: 'assistant', content: 'hi' }],
        createdAt: Date.now(),
      }],
      activeSessionId: 'only_one',
    })
    useChatStore.getState().deleteSession('only_one')
    const state = useChatStore.getState()
    expect(state.sessions.length).toBe(1)
    expect(state.activeSessionId).toBe(state.sessions[0].id)
  })

  test('deleting non-active session keeps active session', () => {
    useChatStore.setState({
      sessions: [
        { id: 's1', title: 'Chat 1', messages: [], createdAt: Date.now() },
        { id: 's2', title: 'Chat 2', messages: [], createdAt: Date.now() },
      ],
      activeSessionId: 's1',
    })
    useChatStore.getState().deleteSession('s2')
    const state = useChatStore.getState()
    expect(state.sessions.length).toBe(1)
    expect(state.activeSessionId).toBe('s1')
    expect(state.sessions[0].id).toBe('s1')
  })
})

describe('health profile', () => {
  test('health profile can be set and retrieved', () => {
    useChatStore.getState().setHealthProfile({
      name: 'John',
      age: '30',
      gender: 'Male',
      location: 'New York',
      weight: '70',
      height: '175',
      bloodGroup: 'A+',
      conditions: 'Diabetes',
      allergies: 'Penicillin',
      medications: 'Metformin',
    })
    const profile = useChatStore.getState().healthProfile
    expect(profile.name).toBe('John')
    expect(profile.age).toBe('30')
    expect(profile.gender).toBe('Male')
    expect(profile.location).toBe('New York')
    expect(profile.weight).toBe('70')
    expect(profile.height).toBe('175')
    expect(profile.bloodGroup).toBe('A+')
    expect(profile.conditions).toBe('Diabetes')
    expect(profile.allergies).toBe('Penicillin')
    expect(profile.medications).toBe('Metformin')
  })

  test('empty profile fields are empty strings', () => {
    useChatStore.getState().setHealthProfile({
      name: '', age: '', gender: '', location: '',
      weight: '', height: '', bloodGroup: '',
      conditions: '', allergies: '', medications: '',
    })
    const profile = useChatStore.getState().healthProfile
    Object.values(profile).forEach(v => expect(v).toBe(''))
  })
})

describe('UI state', () => {
  test('sidebar toggles', () => {
    const prev = useChatStore.getState().sidebarOpen
    useChatStore.getState().toggleSidebar()
    expect(useChatStore.getState().sidebarOpen).toBe(!prev)
  })

  test('typing state can be set', () => {
    useChatStore.getState().setTyping(true)
    expect(useChatStore.getState().isTyping).toBe(true)
    useChatStore.getState().setTyping(false)
    expect(useChatStore.getState().isTyping).toBe(false)
  })

  test('setActiveSession changes active session', () => {
    useChatStore.setState({
      sessions: [
        { id: 'a', title: 'A', messages: [], createdAt: Date.now() },
        { id: 'b', title: 'B', messages: [], createdAt: Date.now() },
      ],
      activeSessionId: 'a',
    })
    useChatStore.getState().setActiveSession('b')
    expect(useChatStore.getState().activeSessionId).toBe('b')
  })
})
