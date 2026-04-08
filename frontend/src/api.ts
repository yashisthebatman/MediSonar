import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

export const sendChatMessage = async (
  userId: string,
  message: string,
  healthProfile?: Record<string, string>,
  history?: { role: string; content: string }[]
) => {
  const response = await axios.post(`${API_BASE}/chat`, {
    user_id: userId,
    message,
    health_profile: healthProfile || null,
    history: history || [],
  });
  return response.data;
};

export const sendChatWithFiles = async (
  userId: string,
  message: string,
  healthProfile: Record<string, string>,
  files: { name: string; type: string; data: string }[],
  history?: { role: string; content: string }[]
) => {
  const response = await axios.post(`${API_BASE}/chat/files`, {
    user_id: userId,
    message,
    health_profile: healthProfile || null,
    files,
    history: history || [],
  });
  return response.data;
};

export const generateReport = async (messages: Array<{ role: string; content: string }>, healthProfile: Record<string, string>) => {
  const response = await axios.post(`${API_BASE}/report`, {
    messages,
    health_profile: healthProfile,
  }, { responseType: 'blob' });
  return response.data;
};

export const getAdvisories = async (location: string, conditions: string) => {
  const response = await axios.post(`${API_BASE}/advisories`, {
    location,
    conditions,
  });
  return response.data;
};

export const findSpecialists = async (disease: string, location: string) => {
  const response = await axios.post(`${API_BASE}/specialists`, {
    disease,
    location,
  });
  return response.data;
};

export const scanFingerprintBloodGroup = async () => {
  const response = await axios.post(`${API_BASE}/fingerprint/scan`, {});
  return response.data as {
    blood_group: string;
    confidence: number;
    source: string;
    serial_port?: string;
    image_path?: string;
    model?: string;
  };
};
