import axios from 'axios';
import Constants from 'expo-constants';

//const API_URL = Constants.expoConfig?.extra?.apiUrl || 'https://localhost:7188';
//const API_URL = 'https://localhost:7188';
const API_URL = 'http://localhost:5265';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add request interceptor for adding auth tokens, etc.
api.interceptors.request.use((config) => {
  // Example: Add authentication token
  // const token = await AsyncStorage.getItem('userToken');
  // if (token) {
  //   config.headers.Authorization = `Bearer ${token}`;
  // }
  return config;
});

export const apiGet = (endpoint: string, params?: any) => 
  api.get(endpoint, { params });

export const apiPost = (endpoint: string, data: any) => 
  api.post(endpoint, data);

// Add other methods as needed (put, delete, etc.)