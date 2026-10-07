/** Types mirroring the backend OpenAPI schemas (see openapi.json). */

export interface User {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface RegisterInput {
  email: string;
  fullName?: string | null;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface AccessTokenResponse {
  accessToken: string;
}
