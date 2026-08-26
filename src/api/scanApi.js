import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_RESULTS = {
  deepfake: {
    id: 'mock-001',
    verdict: 'DEEPFAKE_DETECTED',
    confidence: 88.5,
    media_type: 'image',
    filename: 'sample_image.jpg',
    timestamp: new Date().toISOString(),
    flags: [
      { label: 'Frequency Noise Anomaly', severity: 'high', description: 'Irregular high-frequency artifacts detected in facial region' },
      { label: 'GAN Fingerprint Detected', severity: 'high', description: 'Spectral patterns consistent with StyleGAN2 generation' },
      { label: 'Missing Camera EXIF', severity: 'medium', description: 'No authentic camera metadata present in file headers' },
      { label: 'Facial Landmark Inconsistency', severity: 'medium', description: 'Asymmetric blinking patterns detected around eye region' },
    ],
    heatmap_available: true,
    processing_time_ms: 1243,
    model_version: 'DeepGuard-v3.1',
    engine_metadata: {
      fft_anomaly_score: 84.2,
      dct_anomaly_score: 76.5
    },
    ensemble_weights: {
      spatial: 55,
      temporal: 25,
      audio: 0,
      metadata: 20
    }
  },
  authentic: {
    id: 'mock-002',
    verdict: 'AUTHENTIC',
    confidence: 97.2,
    media_type: 'image',
    filename: 'authentic_photo.jpg',
    timestamp: new Date().toISOString(),
    flags: [],
    heatmap_available: false,
    processing_time_ms: 892,
    model_version: 'DeepGuard-v3.1',
    engine_metadata: {
      fft_anomaly_score: 11.5,
      dct_anomaly_score: 14.8
    },
    ensemble_weights: {
      spatial: 40,
      temporal: 30,
      audio: 0,
      metadata: 30
    }
  },
  suspicious: {
    id: 'mock-003',
    verdict: 'SUSPICIOUS',
    confidence: 57.3,
    media_type: 'audio',
    filename: 'voice_sample.wav',
    timestamp: new Date().toISOString(),
    flags: [
      { label: 'Voice Clone Markers', severity: 'medium', description: 'Mel-spectrogram shows synthetic vocal tract characteristics' },
      { label: 'Background Noise Suppression', severity: 'low', description: 'Unnaturally clean audio floor suggests AI denoising' },
    ],
    heatmap_available: false,
    processing_time_ms: 2100,
    model_version: 'VoiceGuard-v2.0',
    engine_metadata: {
      fft_anomaly_score: 52.8,
      dct_anomaly_score: 41.2
    },
    ensemble_weights: {
      spatial: 0,
      temporal: 20,
      audio: 65,
      metadata: 15
    }
  },
  phishing: {
    id: 'mock-004',
    verdict: 'PHISHING_DETECTED',
    confidence: 94.1,
    media_type: 'url',
    url: 'http://paypa1-secure-login.xyz/account',
    timestamp: new Date().toISOString(),
    flags: [
      { label: 'Phishing Domain Keyword Match', severity: 'high', description: 'Domain mimics PayPal using character substitution (1 for l)' },
      { label: 'Suspicious TLD', severity: 'high', description: '.xyz TLD commonly associated with phishing campaigns' },
      { label: 'No SSL Certificate', severity: 'high', description: 'Domain lacks valid HTTPS certificate' },
      { label: 'Newly Registered Domain', severity: 'medium', description: 'Domain registered < 7 days ago' },
    ],
    heatmap_available: false,
    processing_time_ms: 540,
    model_version: 'PhishGuard-v1.5',
    engine_metadata: {
      fft_anomaly_score: 0.0,
      dct_anomaly_score: 0.0
    },
    ensemble_weights: {
      spatial: 0,
      temporal: 0,
      audio: 0,
      metadata: 100
    }
  },
};

export const MOCK_HISTORY = [
  { id: 'h-001', filename: 'profile_pic.jpg', media_type: 'image', verdict: 'DEEPFAKE_DETECTED', confidence: 88.5, timestamp: '2026-08-18T07:12:00Z' },
  { id: 'h-002', filename: 'news_clip.mp4', media_type: 'video', verdict: 'SUSPICIOUS', confidence: 61.2, timestamp: '2026-08-18T06:45:00Z' },
  { id: 'h-003', filename: 'invoice.pdf', media_type: 'pdf', verdict: 'AUTHENTIC', confidence: 98.1, timestamp: '2026-08-18T05:30:00Z' },
  { id: 'h-004', filename: 'voice_message.mp3', media_type: 'audio', verdict: 'DEEPFAKE_DETECTED', confidence: 79.3, timestamp: '2026-08-17T22:15:00Z' },
  { id: 'h-005', url: 'http://bank-secure.info/login', media_type: 'url', verdict: 'PHISHING_DETECTED', confidence: 91.7, timestamp: '2026-08-17T20:00:00Z' },
  { id: 'h-006', filename: 'screenshot.png', media_type: 'image', verdict: 'AUTHENTIC', confidence: 96.4, timestamp: '2026-08-17T18:30:00Z' },
];

const MOCK_ADMIN_METRICS = {
  total_scanned: 14829,
  deepfakes_flagged: 2341,
  phishing_blocked: 987,
  avg_latency_ms: 1147,
  weekly_threats: [
    { day: 'Mon', deepfakes: 120, phishing: 45, authentic: 380 },
    { day: 'Tue', deepfakes: 185, phishing: 62, authentic: 420 },
    { day: 'Wed', deepfakes: 97, phishing: 38, authentic: 310 },
    { day: 'Thu', deepfakes: 210, phishing: 75, authentic: 490 },
    { day: 'Fri', deepfakes: 340, phishing: 120, authentic: 560 },
    { day: 'Sat', deepfakes: 165, phishing: 55, authentic: 280 },
    { day: 'Sun', deepfakes: 88, phishing: 30, authentic: 210 },
  ],
  media_distribution: [
    { name: 'Images', value: 5820, color: '#06b6d4' },
    { name: 'Videos', value: 3210, color: '#8b5cf6' },
    { name: 'Audio', value: 2140, color: '#f59e0b' },
    { name: 'URLs', value: 2180, color: '#ef4444' },
    { name: 'PDFs', value: 1479, color: '#22c55e' },
  ],
  borderline_cases: [
    { id: 'bc-001', filename: 'interview_clip.mp4', media_type: 'video', confidence: 53.2, timestamp: '2026-08-18T07:45:00Z', status: 'pending' },
    { id: 'bc-002', filename: 'ceo_voice.wav', media_type: 'audio', confidence: 61.8, timestamp: '2026-08-18T06:30:00Z', status: 'pending' },
    { id: 'bc-003', filename: 'passport_scan.jpg', media_type: 'image', confidence: 48.5, timestamp: '2026-08-18T05:20:00Z', status: 'pending' },
    { id: 'bc-004', url: 'https://amaz0n-deals.co/prime', media_type: 'url', confidence: 57.9, timestamp: '2026-08-17T23:10:00Z', status: 'pending' },
    { id: 'bc-005', filename: 'contract.pdf', media_type: 'pdf', confidence: 46.1, timestamp: '2026-08-17T21:45:00Z', status: 'confirmed' },
  ],
};

const MOCK_ALERT_FEED = [
  { id: 'a-001', severity: 'critical', message: 'Deepfake video detected — user @johndoe123', media_type: 'video', timestamp: new Date(Date.now() - 12000).toISOString() },
  { id: 'a-002', severity: 'high', message: 'Phishing URL blocked: secure-paypal-login.ru', media_type: 'url', timestamp: new Date(Date.now() - 45000).toISOString() },
  { id: 'a-003', severity: 'medium', message: 'Suspicious audio file flagged for review', media_type: 'audio', timestamp: new Date(Date.now() - 120000).toISOString() },
  { id: 'a-004', severity: 'critical', message: 'GAN-generated face detected in document submission', media_type: 'image', timestamp: new Date(Date.now() - 300000).toISOString() },
  { id: 'a-005', severity: 'high', message: 'Voice cloning markers detected in support call recording', media_type: 'audio', timestamp: new Date(Date.now() - 600000).toISOString() },
];

// ─── Mock Result Generator ─────────────────────────────────────────────────────

function getMockResult(file, mediaType) {
  const verdicts = ['deepfake', 'suspicious', 'authentic'];
  const pick = verdicts[Math.floor(Math.random() * verdicts.length)];
  const result = { ...MOCK_RESULTS[pick] };
  result.id = `mock-${Date.now()}`;
  result.filename = file?.name || result.filename;
  result.media_type = mediaType || result.media_type;
  result.timestamp = new Date().toISOString();
  return result;
}

// ─── API Functions ─────────────────────────────────────────────────────────────

export async function scanFile(file, mediaType) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('media_type', mediaType);

    const response = await api.post('/scan/file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { data: response.data, isMock: false };
  } catch (error) {
    console.warn('[scanApi] API offline, using mock data:', error.message);
    await new Promise(r => setTimeout(r, 2500)); // simulate processing
    return { data: getMockResult(file, mediaType), isMock: true };
  }
}

export async function scanUrl(url) {
  try {
    const response = await api.post('/scan/url', { url });
    return { data: response.data, isMock: false };
  } catch (error) {
    console.warn('[scanApi] API offline, using mock data:', error.message);
    await new Promise(r => setTimeout(r, 1500));
    const result = { ...MOCK_RESULTS.phishing };
    result.id = `mock-${Date.now()}`;
    result.url = url;
    result.timestamp = new Date().toISOString();
    return { data: result, isMock: true };
  }
}

export async function getScanHistory() {
  try {
    const response = await api.get('/scan/history');
    return response.data;
  } catch {
    return MOCK_HISTORY;
  }
}

export async function getScanJobStatus(jobId) {
  const response = await api.get(`/scan/status/${jobId}`);
  return response.data;
}

export async function getAdminMetrics() {
  try {
    const response = await api.get('/admin/metrics');
    return response.data;
  } catch {
    return MOCK_ADMIN_METRICS;
  }
}

export async function getAlertFeed() {
  try {
    const response = await api.get('/admin/alerts');
    return response.data;
  } catch {
    return MOCK_ALERT_FEED;
  }
}

export async function loginUser(email, password) {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
}

export async function registerUser(email, password, role = 'USER', full_name = null) {
  const payload = { email, password, role };
  if (full_name) payload.full_name = full_name;
  const response = await api.post('/auth/register', payload);
  return response.data;
}

export async function getMe() {
  const response = await api.get('/auth/me');
  return response.data;
}

export async function getUserScans() {
  const response = await api.get('/user/scans');
  return response.data;
}

export async function getAdminUsersList() {
  const response = await api.get('/admin/users');
  return response.data;
}

export async function toggleUserActiveStatus(userId) {
  const response = await api.post(`/admin/users/${userId}/toggle-active`);
  return response.data;
}

export async function getAdminAnalytics(days = 30) {
  try {
    const response = await api.get(`/admin/analytics?days=${days}`);
    return response.data;
  } catch {
    return null;
  }
}

export async function getAdminAuditLogs(limit = 50, offset = 0) {
  try {
    const response = await api.get(`/admin/audit-logs?limit=${limit}&offset=${offset}`);
    return response.data;
  } catch {
    return [];
  }
}

export async function sandboxUrl(url) {
  const response = await api.post('/scan/url/sandbox', { url });
  return response.data;
}

export async function getMonitors() {
  const response = await api.get('/monitors');
  return response.data;
}

export async function createMonitor(data) {
  const response = await api.post('/monitors', data);
  return response.data;
}

export async function deleteMonitor(id) {
  const response = await api.delete(`/monitors/${id}`);
  return response.data;
}

export async function getHitlQueue() {
  const response = await api.get('/admin/hitl');
  return response.data;
}

export async function submitHitlReview(scanId, data) {
  const response = await api.post(`/admin/hitl/${scanId}/review`, data);
  return response.data;
}

export async function exportDataset(format = 'PyTorch') {
  const response = await api.post('/admin/dataset/export', { format }, { responseType: 'blob' });
  return response.data;
}

export async function getThreatMap() {
  const response = await api.get('/admin/threat-map');
  return response.data;
}

export async function getRbacRoles() {
  const response = await api.get('/admin/rbac/roles');
  return response.data;
}

export async function issueApiKey(data) {
  const response = await api.post('/admin/rbac/keys', data);
  return response.data;
}

export async function exportSiemLogs() {
  const response = await api.get('/admin/siem/logs');
  return response.data;
}

export async function demoLogin(role = 'USER') {
  const response = await api.post('/auth/demo-login', { role });
  return response.data;
}

export async function googleSsoLogin(payload = {}) {
  const response = await api.post('/auth/google', payload);
  return response.data;
}

// ─── Team Management ──────────────────────────────────────────────────────────
export async function getTeams() {
  const response = await api.get('/teams');
  return response.data;
}

export async function createTeam(name, orgName = '') {
  const response = await api.post('/teams', { name, org_name: orgName });
  return response.data;
}

export async function getTeamMembers(teamId) {
  const response = await api.get(`/teams/${teamId}/members`);
  return response.data;
}

export async function addTeamMember(teamId, email, role = 'MEMBER') {
  const response = await api.post(`/teams/${teamId}/members`, { email, role });
  return response.data;
}

export async function removeTeamMember(teamId, userId) {
  const response = await api.delete(`/teams/${teamId}/members/${userId}`);
  return response.data;
}

// ─── Password Reset & Email Verification ──────────────────────────────────────
export async function requestPasswordReset(email) {
  const response = await api.post('/auth/password-reset/request', { email });
  return response.data;
}

export async function confirmPasswordReset(token, newPassword) {
  const response = await api.post('/auth/password-reset/confirm', { token, new_password: newPassword });
  return response.data;
}

export async function requestEmailVerification() {
  const response = await api.post('/auth/email-verification/request');
  return response.data;
}

export async function verifyEmail(token) {
  const response = await api.post('/auth/email-verification/verify', { token });
  return response.data;
}

export { MOCK_ADMIN_METRICS, MOCK_ALERT_FEED };
