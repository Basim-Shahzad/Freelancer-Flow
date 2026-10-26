import type {
  ApiInvoiceDisplayStatus, InvoiceEventListResponse, InvoiceListResponse, InvoiceResponse, InvoiceSendResponse, InvoiceShareLinks,
  PaymentCreate, PaymentResponse, ShareChannel,
} from "@/lib/api/invoices.types";
import { cleanParams, toListResult, type ListParams } from "@/lib/api/pagination";
import { api } from "./api.service";

/** Query params of `GET /invoices` (`client_id` / `project_id` are snake_case on the wire; `search` is the invoice number). */
export interface InvoiceListParams extends ListParams {
  status?: ApiInvoiceDisplayStatus;
  client_id?: string;
  project_id?: string;
}

const base = (id: string) => `/invoices/${id}`;

export const invoicesService = {
  list: (params: InvoiceListParams = {}) =>
    api.get<InvoiceListResponse>("/invoices", { params: cleanParams(params) }).then((r) => toListResult(r.data, "invoices")),
  get: (id: string) => api.get<InvoiceResponse>(base(id)).then((r) => r.data),
  /** The authenticated PDF, as a Blob. */
  pdf: (id: string) => api.get<Blob>(`${base(id)}/pdf`, { responseType: "blob" }).then((r) => r.data),
  send: (id: string, channel: ShareChannel) => api.post<InvoiceSendResponse>(`${base(id)}/send`, { channel }).then((r) => r.data),
  remind: (id: string, channel: ShareChannel) => api.post<InvoiceSendResponse>(`${base(id)}/remind`, { channel }).then((r) => r.data),
  share: (id: string) => api.get<InvoiceShareLinks>(`${base(id)}/share`).then((r) => r.data),
  cancel: (id: string) => api.post<InvoiceResponse>(`${base(id)}/cancel`).then((r) => r.data),
  writeOff: (id: string, reason: string) => api.post<InvoiceResponse>(`${base(id)}/write-off`, { reason }).then((r) => r.data),
  reverseWriteOff: (id: string) => api.post<InvoiceResponse>(`${base(id)}/reverse-write-off`).then((r) => r.data),
  events: (id: string) => api.get<InvoiceEventListResponse>(`${base(id)}/events`).then((r) => r.data.events),
  payments: (id: string) => api.get<PaymentResponse[]>(`${base(id)}/payments`).then((r) => r.data),
  /** Returns the updated invoice. */
  recordPayment: (id: string, body: PaymentCreate) => api.post<InvoiceResponse>(`${base(id)}/payments`, body).then((r) => r.data),
  /** Returns the updated invoice. */
  voidPayment: (id: string, paymentId: string) => api.delete<InvoiceResponse>(`${base(id)}/payments/${paymentId}`).then((r) => r.data),
};
