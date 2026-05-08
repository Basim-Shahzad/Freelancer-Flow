export interface User {
   id: string;
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

export interface Tokens {
   access: string;
   refresh: string;
}

export interface LoginResponse extends Tokens {
   user: User
}

export interface SignupResponse extends Tokens {
   user: User
}