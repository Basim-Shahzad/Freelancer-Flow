export interface User {
   id: string;
   fullName: string;
   email: string;
   role: string;
   isActive: boolean;
   isVerified: boolean;
   createdAt: string;
   lastLoginAt: string | null;
}

export interface Tokens {
   accessToken: string;
   refreshToken: string;
}

export type LoginResponse = Tokens;

export type SignupResponse = User;

export type LogoutResponse = { message: string };
