import axios from "axios";
import type { MilestoneDecision, MilestoneResponse, PortalConvertRequest, PortalInvoiceResponse, PortalProjectResponse } from "@/lib/api/portal.types";
import { API_URL } from "./api.service";

/**
 * Isolated client for the token-based portal. No cookies, no auth store, no refresh interceptor:
 * a 401/403 here means the link is expired or invalid, never "sign the user out". The portal
 * token is passed per call and kept nowhere in this module.
 */
export const portalApi = axios.create({ baseURL: API_URL, withCredentials: false });

const auth = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

export const portalService = {
  project: (id: string, token: string) => portalApi.get<PortalProjectResponse>(`/portal/project/${id}`, auth(token)).then((r) => r.data),
  milestone: (id: string, token: string) => portalApi.get<MilestoneResponse>(`/portal/milestone/${id}`, auth(token)).then((r) => r.data),
  approve: (id: string, token: string, comment?: string) =>
    portalApi.post<MilestoneResponse>(`/portal/milestone/${id}/approve`, body(comment), auth(token)).then((r) => r.data),
  reject: (id: string, token: string, comment?: string) =>
    portalApi.post<MilestoneResponse>(`/portal/milestone/${id}/reject`, body(comment), auth(token)).then((r) => r.data),
  invoice: (id: string, token: string) => portalApi.get<PortalInvoiceResponse>(`/portal/invoice/${id}`, auth(token)).then((r) => r.data),
  invoicePdf: (id: string, token: string) =>
    portalApi.get<Blob>(`/portal/invoice/${id}/pdf`, { ...auth(token), responseType: "blob" }).then((r) => r.data),
  convert: (token: string, password: string) =>
    portalApi.post<unknown>("/portal/convert", { password } satisfies PortalConvertRequest, auth(token)).then((r) => r.data),
};

function body(comment?: string): MilestoneDecision {
  const c = comment?.trim();
  return c ? { comment: c } : {};
}
