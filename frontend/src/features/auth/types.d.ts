export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
}

export interface User {
  id: number;
  email: string;
  username: string;
  hourly_rate?: number;
  phone?: string;
  logo?: string;
  created_at?: string;
}

export interface ApiError {
  detail?: string;
  message?: string;
  email?: string[];
  username?: string[];
  password?: string[];
}