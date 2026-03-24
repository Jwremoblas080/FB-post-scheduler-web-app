import axios from 'axios';

// In production, set VITE_API_URL to your API Gateway URL
// e.g. https://abc123.execute-api.us-east-1.amazonaws.com
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

export default apiClient;
