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

export default apiClient;
