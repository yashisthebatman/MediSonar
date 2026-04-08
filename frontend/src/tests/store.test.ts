import { describe, expect, test } from 'vitest';

import { useChatStore } from '../store';

describe('store initialization', () => {
  test('store initializes with one session', () => {
    const state = useChatStore.getState();
    expect(state.sessions.length).toBe(1);
    expect(state.sessions[0].messages[0].role).toBe('assistant');
  });

  test('store has correct initial state', () => {
    const state = useChatStore.getState();
    expect(state.isTyping).toBe(false);
    expect(state.sidebarOpen).toBe(true);
    expect(state.activeSessionId).toBe('session_1');
    expect(state.healthProfile.name).toBe('');
  });
});

describe('session management', () => {
  test('store can create a new session', () => {
    const previousCount = useChatStore.getState().sessions.length;
    useChatStore.getState().createSession();
    const state = useChatStore.getState();
    expect(state.sessions.length).toBe(previousCount + 1);
    expect(state.activeSessionId).toBe(state.sessions[state.sessions.length - 1].id);
  });

  test('first user message sets session title', () => {
    useChatStore.getState().createSession();
    const state = useChatStore.getState();
    const newSessionId = state.sessions[state.sessions.length - 1].id;
    state.setActiveSession(newSessionId);
    state.addMessage({ id: 't1', role: 'user', content: 'I have a headache and fever' });
    const updated = useChatStore.getState().sessions.find((session) => session.id === newSessionId)!;
    expect(updated.title).toBe('I have a headache and fever');
  });

  test('long first message gets truncated for title', () => {
    useChatStore.setState({
      sessions: [
        {
          id: 'truncate_test',
          title: 'New Chat',
          messages: [{ id: '1', role: 'assistant', content: 'hi' }],
          createdAt: Date.now(),
        },
      ],
      activeSessionId: 'truncate_test',
    });
    useChatStore.getState().addMessage({
      id: 't2',
      role: 'user',
      content: 'This is a very long message that should be truncated for the session title display',
    });
    const updated = useChatStore.getState().sessions.find((session) => session.id === 'truncate_test')!;
    expect(updated.title).toBe('This is a very long message ...');
  });
});

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
    });
    const profile = useChatStore.getState().healthProfile;
    expect(profile.name).toBe('John');
    expect(profile.age).toBe('30');
    expect(profile.location).toBe('New York');
    expect(profile.medications).toBe('Metformin');
  });
});
