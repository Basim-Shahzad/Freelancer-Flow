export interface LoginCredentials {
   email: string;
   password: string;
}

export interface SignupCredentials {
   username: string;
   email: string;
   password1: string;
}

export interface AuthResponse {
   access: string;
   refresh: string;
}

export interface User {
   id: number;
   username: string;
   email: string;
   dateJoined?: string;
   logo: string;
   phone: string;
   taxId: string;
   businessName: string;
   lastLogin: string;
   revenue: number;
   hourlyRate?: number;
   createdAt?: string;
}

export interface ApiError {
   detail?: string;
   message?: string;
   email?: string[];
   username?: string[];
   password?: string[];
}
