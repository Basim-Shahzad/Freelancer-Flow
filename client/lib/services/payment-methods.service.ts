import type { PaymentMethodCreate, PaymentMethodListResponse, PaymentMethodResponse, PaymentMethodUpdate } from "@/lib/api/payment-methods.types";
import { api } from "./api.service";

export const paymentMethodsService = {
  list: (includeInactive = true) =>
    api.get<PaymentMethodListResponse>("/payment-methods", { params: { include_inactive: includeInactive } }).then((r) => r.data.paymentMethods),
  get: (id: string) => api.get<PaymentMethodResponse>(`/payment-methods/${id}`).then((r) => r.data),
  create: (body: PaymentMethodCreate) => api.post<PaymentMethodResponse>("/payment-methods", body).then((r) => r.data),
  patch: (id: string, body: PaymentMethodUpdate) => api.patch<PaymentMethodResponse>(`/payment-methods/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/payment-methods/${id}`).then(() => undefined),
  /** `ids` must list every method exactly once; the response is the full list in the new order. */
  reorder: (ids: string[]) => api.put<PaymentMethodListResponse>("/payment-methods/order", { ids }).then((r) => r.data.paymentMethods),
};
