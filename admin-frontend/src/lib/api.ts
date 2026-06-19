//const BASE_URL = 'http://13.232.78.99:3005/api';
const BASE_URL = 'https://hirebot-api.indusnettechnologies.com/api';
//const BASE_URL = 'http://localhost:3005/api';
export const GOOGLE_OAUTH_CLIENT_ID = '568399172851-8bq532uu4tcibj8ch4nv00lg3795ql60.apps.googleusercontent.com';
const getAuthHeaders = (isFormData: boolean = false): HeadersInit => {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    // Check if the error is 401 Unauthorized
    if (response.status === 401) {
      // Clear local storage to sync state
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Redirect to login page
      window.location.href = '/login';
      
      throw new Error('Session expired. Please login again.');
    }

    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || 'Request failed');
  }
  return response.json();
};

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(response);
  },
  register: async (name: string, email: string, password: string) => {
    const response = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    return handleResponse(response);
  },
  googleLogin: async (idToken: string) => {
    const response = await fetch(`${BASE_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    return handleResponse(response);
  },
};

// Clients API
export const clientsApi = {
  getAll: async () => {
    const response = await fetch(`${BASE_URL}/clients`, { headers: getAuthHeaders() });
    return handleResponse(response);
  },
  getById: async (id: string) => {
    const response = await fetch(`${BASE_URL}/clients/${id}`, { headers: getAuthHeaders() });
    return handleResponse(response);
  },
  create: async (data: any) => {
    const response = await fetch(`${BASE_URL}/clients`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return handleResponse(response);
  },
  update: async (id: string, data: any) => {
    const response = await fetch(`${BASE_URL}/clients/${id}`, {
      method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return handleResponse(response);
  },
  delete: async (id: string) => {
    const response = await fetch(`${BASE_URL}/clients/${id}`, {
      method: 'DELETE', headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// Jobs API
export const jobsApi = {
  getAll: async () => {
    const response = await fetch(`${BASE_URL}/jobs`, { headers: getAuthHeaders() });
    return handleResponse(response);
  },
  getById: async (id: string) => {
    const response = await fetch(`${BASE_URL}/jobs/${id}`, { headers: getAuthHeaders() });
    return handleResponse(response);
  },
  create: async (data: any) => {
    const isFormData = data instanceof FormData;
    const response = await fetch(`${BASE_URL}/jobs`, {
      method: 'POST', headers: getAuthHeaders(isFormData),
      body: isFormData ? data : JSON.stringify(data),
    });
    return handleResponse(response);
  },
  update: async (id: string, data: any) => {
    const response = await fetch(`${BASE_URL}/jobs/${id}`, {
      method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(data),
    });
    return handleResponse(response);
  },
  delete: async (id: string) => {
    const response = await fetch(`${BASE_URL}/jobs/${id}`, {
      method: 'DELETE', headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
  bulkUpload: async (data: FormData) => {
    const response = await fetch(`${BASE_URL}/jobs/bulk-upload`, {
      method: 'POST', headers: getAuthHeaders(true),
      body: data,
    });
    return handleResponse(response);
  },
};

// Candidates API
export const candidatesApi = {
  getAll: async () => {
    const response = await fetch(`${BASE_URL}/candidates`, { headers: getAuthHeaders() });
    return handleResponse(response);
  },
  getById: async (id: string) => {
    const response = await fetch(`${BASE_URL}/candidates/${id}`, { headers: getAuthHeaders() });
    return handleResponse(response);
  },
  create: async (data: any) => {
    const isFormData = data instanceof FormData;
    const response = await fetch(`${BASE_URL}/candidates/single`, {
      method: 'POST', headers: getAuthHeaders(isFormData),
      body: isFormData ? data : JSON.stringify(data),
    });
    return handleResponse(response);
  },
  bulkUpload: async (candidates: any[]) => {
    const response = await fetch(`${BASE_URL}/candidates/bulk`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(candidates),
    });
    return handleResponse(response);
  },
  bulkUploadCV: async (data: FormData) => {
    const response = await fetch(`${BASE_URL}/candidates/bulk-upload-cv`, {
      method: 'POST', headers: getAuthHeaders(true),
      body: data,
    });
    return handleResponse(response);
  },
  getBulkUploadStatus: async (jobId: string) => {
    const response = await fetch(`${BASE_URL}/candidates/bulk-upload-status/${jobId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
  update: async (id: string, data: any) => {
    const isFormData = data instanceof FormData;
    const response = await fetch(`${BASE_URL}/candidates/${id}`, {
      method: 'PATCH', 
      headers: getAuthHeaders(isFormData), 
      body: isFormData ? data : JSON.stringify(data),
    });
    return handleResponse(response);
  },
  delete: async (id: string) => {
    const response = await fetch(`${BASE_URL}/candidates/${id}`, {
      method: 'DELETE', headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// Call Logs API
export const callLogsApi = {
  getAll: async () => {
    const response = await fetch(`${BASE_URL}/calls`, { headers: getAuthHeaders() });
    return handleResponse(response);
  },
  triggerCall: async (payload: {
    targetId: string;
    jobId?: string;
    voiceId?: string;
    voice_name?: string;
    customPrompt?: string;
  }) => {
    const { targetId, voiceId, voice_name, customPrompt } = payload;
    const response = await fetch(`${BASE_URL}/calls/outbound`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ targetId, voiceId, voice_name, customPrompt }),
    });
    return handleResponse(response);
  },
  getUpcoming: async () => {
    const response = await fetch(`${BASE_URL}/calls/upcoming`, { headers: getAuthHeaders() });
    return handleResponse(response);
  },
  getById: async (id: string) => {
    const response = await fetch(`${BASE_URL}/calls/${id}`, { headers: getAuthHeaders() });
    return handleResponse(response);
  },
  removeFromQueue: async (id: string) => {
    const response = await fetch(`${BASE_URL}/calls/queue/${id}`, {
      method: 'DELETE', headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
  clearAllUpcoming: async () => {
    const response = await fetch(`${BASE_URL}/calls/queue/clear-all`, {
      method: 'DELETE', headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// Job Questions API
export const jobQuestionsApi = {
  getQuestions: async (jobId: string) => {
    const response = await fetch(`${BASE_URL}/jobs/${jobId}/questions`, { headers: getAuthHeaders() });
    return handleResponse(response);
  },
  updateQuestions: async (jobId: string, questions: string[]) => {
    const response = await fetch(`${BASE_URL}/jobs/${jobId}/questions`, {
      method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ questions }),
    });
    return handleResponse(response);
  },
};

// Users API
export const usersApi = {
  getAll: async () => {
    const response = await fetch(`${BASE_URL}/auth/users`, { headers: getAuthHeaders() });
    return handleResponse(response);
  },
  delete: async (id: string) => {
    const response = await fetch(`${BASE_URL}/auth/users/${id}`, {
      method: 'DELETE', headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// Feedback API
export const feedbackApi = {
  // POST /api/feedback — save a new feedback entry
  create: async (payload: {
    callLogId: string;
    candidateName: string;
    originalText: string;
    feedbackText: string;
  }) => {
    const response = await fetch(`${BASE_URL}/feedback`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(response);
  },

  // GET /api/feedback?search=&limit=
  getAll: async (params?: { search?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.limit)  query.set('limit', String(params.limit));
    const qs = query.toString() ? `?${query.toString()}` : '';
    const response = await fetch(`${BASE_URL}/feedback${qs}`, { headers: getAuthHeaders() });
    return handleResponse(response);
  },

  // GET /api/feedback/call/:callLogId
  getByCall: async (callLogId: string) => {
    const response = await fetch(`${BASE_URL}/feedback/call/${callLogId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  // DELETE /api/feedback/:id
  delete: async (id: string) => {
    const response = await fetch(`${BASE_URL}/feedback/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// Dashboard API
export const dashboardApi = {
  getStats: async () => {
    const response = await fetch(`${BASE_URL}/dashboard/stats`, { 
      headers: getAuthHeaders() 
    });
    return handleResponse(response);
  },
};