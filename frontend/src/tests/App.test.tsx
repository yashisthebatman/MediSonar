import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../App'
import { expect, test, vi, beforeEach, describe } from 'vitest'
import * as api from '../api'
import { useChatStore } from '../store'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api', () => ({
  sendChatMessage: vi.fn(),
  sendChatWithFiles: vi.fn(),
  generateReport: vi.fn().mockResolvedValue(new Blob(['report'])),
  getAdvisories: vi.fn().mockResolvedValue({ advisories: [] }),
  findSpecialists: vi.fn().mockResolvedValue({ specialists: [] }),
  scanFingerprintBloodGroup: vi.fn(),
}))

function resetStore() {
  useChatStore.setState({
    sessions: [{
      id: 'session_1',
      title: 'New Chat',
      messages: [{ id: '1', role: 'assistant', content: 'Hello! I am MediSonar, your premium medical AI assistant. How can I help you today?' }],
      createdAt: Date.now(),
    }],
    activeSessionId: 'session_1',
    isTyping: false,
    sidebarOpen: true,
    healthProfile: { name: '', age: '', gender: '', location: '', conditions: '', allergies: '', medications: '', weight: '', height: '', bloodGroup: '' },
  })
}

beforeEach(() => {
  resetStore()
  vi.clearAllMocks()
})

function renderWithRouter(initialRoute = '/chat') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <App />
    </MemoryRouter>
  )
}

describe('Dashboard page', () => {
  test('renders welcome message', () => {
    renderWithRouter('/')
    expect(screen.getByText(/Welcome back/)).toBeInTheDocument()
  })

  test('renders profile tile', () => {
    renderWithRouter('/')
    expect(screen.getByText('Your Profile')).toBeInTheDocument()
    expect(screen.getByText('Set your name')).toBeInTheDocument()
  })

  test('renders chat tile', () => {
    renderWithRouter('/')
    expect(screen.getByText('AI Consultation')).toBeInTheDocument()
    expect(screen.getByText('Start a Consultation')).toBeInTheDocument()
  })

  test('renders health advisories section', () => {
    renderWithRouter('/')
    expect(screen.getByText('Health Advisories')).toBeInTheDocument()
  })

  test('renders feature badges in chat tile', () => {
    renderWithRouter('/')
    expect(screen.getByText('AI-powered symptom analysis')).toBeInTheDocument()
    expect(screen.getByText('Personalized with your health profile')).toBeInTheDocument()
    expect(screen.getByText('Specialist recommendations included')).toBeInTheDocument()
  })

  test('displays user name in welcome when profile is set', () => {
    useChatStore.getState().setHealthProfile({
      name: 'Yash', age: '', gender: '', location: '', conditions: '', allergies: '', medications: '', weight: '', height: '', bloodGroup: '',
    })
    renderWithRouter('/')
    expect(screen.getByText('Welcome back, Yash')).toBeInTheDocument()
  })
})

describe('Profile page', () => {
  test('renders profile page header', () => {
    renderWithRouter('/profile')
    expect(screen.getByText('Health Profile')).toBeInTheDocument()
  })

  test('renders all text fields', () => {
    renderWithRouter('/profile')
    expect(screen.getByText('Full Name')).toBeInTheDocument()
    expect(screen.getByText('Location / City')).toBeInTheDocument()
    expect(screen.getByText('Existing Conditions')).toBeInTheDocument()
    expect(screen.getByText('Known Allergies')).toBeInTheDocument()
    expect(screen.getByText('Current Medications')).toBeInTheDocument()
  })

  test('renders all number fields with units', () => {
    renderWithRouter('/profile')
    expect(screen.getByText('Age')).toBeInTheDocument()
    expect(screen.getByText('Weight')).toBeInTheDocument()
    expect(screen.getByText('Height')).toBeInTheDocument()
    expect(screen.getByText('years')).toBeInTheDocument()
    expect(screen.getByText('kg')).toBeInTheDocument()
    expect(screen.getByText('cm')).toBeInTheDocument()
  })

  test('renders gender and blood group dropdowns', () => {
    renderWithRouter('/profile')
    expect(screen.getByText('Gender')).toBeInTheDocument()
    expect(screen.getByText('Blood Group')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Scan/i })).toBeInTheDocument()
  })

  test('renders save button', () => {
    renderWithRouter('/profile')
    expect(screen.getByText('Save Profile')).toBeInTheDocument()
  })

  test('renders quick stats', () => {
    renderWithRouter('/profile')
    expect(screen.getByText('Chats')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Location')).toBeInTheDocument()
  })

  test('can fill and save profile', () => {
    renderWithRouter('/profile')
    const nameInput = screen.getByPlaceholderText('John Doe')
    fireEvent.change(nameInput, { target: { value: 'Yash' } })
    const ageInput = screen.getByPlaceholderText('30')
    fireEvent.change(ageInput, { target: { value: '25' } })
    const saveBtn = screen.getByText('Save Profile')
    fireEvent.click(saveBtn)
    expect(screen.getByText('Saved!')).toBeInTheDocument()
    expect(useChatStore.getState().healthProfile.name).toBe('Yash')
    expect(useChatStore.getState().healthProfile.age).toBe('25')
  })

  test('can scan and fill blood group', async () => {
    vi.mocked(api.scanFingerprintBloodGroup).mockResolvedValueOnce({
      blood_group: 'O-',
      confidence: 98.25,
      source: 'test_image',
    })

    renderWithRouter('/profile')
    fireEvent.click(screen.getByRole('button', { name: /Scan/i }))

    await waitFor(() => {
      expect(screen.getByText('Detected O- with 98.25% confidence.')).toBeInTheDocument()
    })
    expect(screen.getByDisplayValue('O-')).toBeInTheDocument()
  })
})

describe('Chat page', () => {
  test('renders chat header with MediSonar branding', () => {
    renderWithRouter('/chat')
    expect(screen.getAllByText('MediSonar').length).toBeGreaterThanOrEqual(1)
  })

  test('renders sidebar with chat history', () => {
    renderWithRouter('/chat')
    expect(screen.getAllByRole('button', { name: /New Chat/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Previous Chats')).toBeInTheDocument()
  })

  test('renders profile name in sidebar when set', () => {
    useChatStore.setState({
      healthProfile: { name: 'Yash', age: '', gender: '', location: '', conditions: '', allergies: '', medications: '', weight: '', height: '', bloodGroup: '' },
    })
    renderWithRouter('/chat')
    expect(screen.getAllByText('Yash').length).toBeGreaterThanOrEqual(1)
  })

  test('renders profile link in sidebar', () => {
    renderWithRouter('/chat')
    expect(screen.getByText('Fill Health Profile')).toBeInTheDocument()
  })

  test('renders download report button', () => {
    renderWithRouter('/chat')
    expect(screen.getByText('Download Report')).toBeInTheDocument()
  })

  test('renders message input', () => {
    renderWithRouter('/chat')
    expect(screen.getByPlaceholderText('Message MediSonar...')).toBeInTheDocument()
  })

  test('renders welcome message in chat', () => {
    renderWithRouter('/chat')
    expect(screen.getByText('Hello! I am MediSonar, your premium medical AI assistant. How can I help you today?')).toBeInTheDocument()
  })

  test('can type and send message', async () => {
    vi.mocked(api.sendChatMessage).mockResolvedValueOnce({
      response: 'Mocked AI response',
      memory_updates: []
    })

    renderWithRouter('/chat')
    const input = screen.getByPlaceholderText('Message MediSonar...')
    fireEvent.change(input, { target: { value: 'Hello AI' } })

    const form = input.closest('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('Mocked AI response')).toBeInTheDocument()
    })
  })

  test('shows error message when API fails', async () => {
    vi.mocked(api.sendChatMessage).mockRejectedValueOnce({
      response: { data: { detail: 'API Key not configured' } }
    })

    renderWithRouter('/chat')
    const input = screen.getByPlaceholderText('Message MediSonar...')
    fireEvent.change(input, { target: { value: 'Test error' } })

    const form = input.closest('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('API Key not configured')).toBeInTheDocument()
    })
  })

  test('cannot send empty message', () => {
    renderWithRouter('/chat')
    const input = screen.getByPlaceholderText('Message MediSonar...')
    const form = input.closest('form')!
    const sendBtn = form.querySelector('button[type="submit"]')
    expect(sendBtn).toBeDisabled()
  })

  test('send button enabled when text is entered', () => {
    renderWithRouter('/chat')
    const input = screen.getByPlaceholderText('Message MediSonar...')
    fireEvent.change(input, { target: { value: 'Hello' } })
    const form = input.closest('form')!
    const sendBtn = form.querySelector('button[type="submit"]')
    expect(sendBtn).not.toBeDisabled()
  })
})
