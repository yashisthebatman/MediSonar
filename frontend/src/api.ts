import axios from 'axios';

const API_BASE = 'http://localhost:8000/api';

export interface Advisory {
  title: string;
  severity: string;
  description: string;
  source?: string;
  url?: string;
}

export interface AdvisoriesResponse {
  advisories: Advisory[];
  cached: boolean;
  fetched_at?: string;
  expires_at?: string;
}

export interface AutismPredictionResponse {
  label: string;
  confidence: number;
  autistic_probability: number;
  non_autistic_probability: number;
  source: string;
  camera_name?: string;
  model: string;
  disclaimer: string;
}

export const sendChatMessage = async (
  userId: string,
  message: string,
  healthProfile?: Record<string, string>,
  history?: { role: string; content: string }[],
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
  history?: { role: string; content: string }[],
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

export const generateReport = async (
  messages: Array<{ role: string; content: string }>,
  healthProfile: Record<string, string>,
) => {
  const response = await axios.post(
    `${API_BASE}/report`,
    {
      messages,
      health_profile: healthProfile,
    },
    { responseType: 'blob' },
  );
  return response.data;
};

export const getAdvisories = async (location: string, conditions: string, forceRefresh = false) => {
  const response = await axios.post<AdvisoriesResponse>(`${API_BASE}/advisories`, {
    location,
    conditions,
    force_refresh: forceRefresh,
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

export const predictAutismFromImage = async (
  imageBase64: string,
  source: 'webcam' | 'upload',
  cameraName = '',
) => {
  const response = await axios.post<AutismPredictionResponse>(`${API_BASE}/autism/predict`, {
    image_base64: imageBase64,
    source,
    camera_name: cameraName,
  });
  return response.data;
};
