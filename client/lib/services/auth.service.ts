import type {
  AccessTokenResponse,
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  User,
} from "@/lib/api/types";
import { api } from "./api.service";

export const authService = {
  register: (input: RegisterInput) => api.post<User>("/auth/register", input).then((r) => r.data),
  login: (input: LoginInput) =>
    api.post<AccessTokenResponse>("/auth/login", input).then((r) => r.data),
  logout: () => api.post<void>("/auth/logout").then(() => undefined),
  logoutAll: () => api.post<void>("/auth/logout-all").then(() => undefined),
  me: () => api.get<User>("/auth/me").then((r) => r.data),
  changePassword: (input: ChangePasswordInput) =>
    api.post<void>("/auth/change-password", input).then(() => undefined),
};
