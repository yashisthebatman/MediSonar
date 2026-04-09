import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import App from '../App';
import * as api from '../api';
import { useChatStore } from '../store';

vi.mock('../api', () => ({
  sendChatMessage: vi.fn(),
  sendChatWithFiles: vi.fn(),
  generateReport: vi.fn().mockResolvedValue(new Blob(['report'])),
  getAdvisories: vi.fn().mockResolvedValue({ advisories: [], cached: false }),
  findSpecialists: vi.fn().mockResolvedValue({ specialists: [] }),
  scanFingerprintBloodGroup: vi.fn(),
  predictAutismFromImage: vi.fn(),
}));

function resetStore() {
  useChatStore.setState({
    sessions: [
      {
        id: 'session_1',
        title: 'New Chat',
        messages: [{ id: '1', role: 'assistant', content: 'Welcome to **MediSonar**.' }],
        createdAt: Date.now(),
      },
    ],
    activeSessionId: 'session_1',
    isTyping: false,
    sidebarOpen: true,
    healthProfile: {
      name: '',
      age: '',
      gender: '',
      location: '',
      conditions: '',
      allergies: '',
      medications: '',
      weight: '',
      height: '',
      bloodGroup: '',
    },
  });
}

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
});

function renderWithRouter(initialRoute = '/chat') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <App />
    </MemoryRouter>,
  );
}

describe('Dashboard page', () => {
  test('renders welcome message', async () => {
    renderWithRouter('/');
    expect(await screen.findByText("Here's your regional health update and tool access.")).toBeInTheDocument();
  });

  test('renders profile tile', async () => {
    renderWithRouter('/');
    expect(await screen.findByText('Set up profile')).toBeInTheDocument();
    expect(await screen.findByText('Action required')).toBeInTheDocument();
  });

  test('renders consultation and autism cards', async () => {
    renderWithRouter('/');
    expect(await screen.findByText('Consultation')).toBeInTheDocument();
    expect(await screen.findByText('Autism Vision Check')).toBeInTheDocument();
  });

  test('renders health advisories section', async () => {
    renderWithRouter('/');
    expect(await screen.findByText('Local Health Advisories')).toBeInTheDocument();
    expect(await screen.findByText('Location not set')).toBeInTheDocument();
  });
});

describe('Profile page', () => {
  test('renders profile page header', async () => {
    renderWithRouter('/profile');
    expect(await screen.findByText('Profile')).toBeInTheDocument();
  });

  test('renders scan and save controls', async () => {
    renderWithRouter('/profile');
    expect(await screen.findByRole('button', { name: /Scan Reader/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(await screen.findByText('Vision Module')).toBeInTheDocument();
  });

  test('can fill and save profile', async () => {
    renderWithRouter('/profile');
    fireEvent.change(await screen.findByPlaceholderText('John Appleseed'), { target: { value: 'Yash' } });
    const numberInputs = await screen.findAllByRole('spinbutton');
    fireEvent.change(numberInputs[0], { target: { value: '25' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Done' }));

    await waitFor(() => {
      expect(useChatStore.getState().healthProfile.name).toBe('Yash');
      expect(useChatStore.getState().healthProfile.age).toBe('25');
    });
  });

  test('can scan and fill blood group', async () => {
    vi.mocked(api.scanFingerprintBloodGroup).mockResolvedValueOnce({
      blood_group: 'O-',
      confidence: 98.25,
      source: 'test_image',
    });

    renderWithRouter('/profile');
    fireEvent.click(await screen.findByRole('button', { name: /Scan Reader/i }));

    await waitFor(() => {
      expect(screen.getByText(/Match found: O-/)).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('O-')).toBeInTheDocument();
  });
});

describe('Chat page', () => {
  test('renders sidebar with chat history', async () => {
    renderWithRouter('/chat');
    expect((await screen.findAllByRole('button', { name: /New Consultation/i })).length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText('Recents')).toBeInTheDocument();
  });

  test('renders message input', async () => {
    renderWithRouter('/chat');
    expect(await screen.findByPlaceholderText('Message MediSonar...')).toBeInTheDocument();
  });

  test('can type and send message', async () => {
    vi.mocked(api.sendChatMessage).mockResolvedValueOnce({
      response: 'Mocked AI response',
      memory_updates: [],
    });

    renderWithRouter('/chat');
    const input = await screen.findByPlaceholderText('Message MediSonar...');
    fireEvent.change(input, { target: { value: 'Hello AI' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Mocked AI response')).toBeInTheDocument();
    });
  });
});
