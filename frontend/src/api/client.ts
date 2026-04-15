import axios from 'axios';

// Localhost: Vite proxy forwards /auth, /posts, /upload to Lambda
// Vercel (prod): VITE_API_URL must point directly to Lambda, OR we use the hardcoded fallback
const LAMBDA_URL = 'https://o6i2c5bnjg.execute-api.us-east-1.amazonaws.com';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/' : LAMBDA_URL),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Add JWT token to all requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses by clearing token and redirecting to login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('fb_connected');
      // Optionally redirect to login
      // window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
