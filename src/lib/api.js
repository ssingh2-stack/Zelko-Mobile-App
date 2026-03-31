import AsyncStorage from "@react-native-async-storage/async-storage";

import Constants from "expo-constants";
const BASE_URL = Constants.expoConfig?.extra?.apiUrl || "https://app.getclipd.ca";

async function getToken() {
  return await AsyncStorage.getItem("mobile_token");
}

async function request(path, options = {}) {
  const token = await getToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["X-Mobile-Token"] = token;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers, signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    if (!res.ok) {
      if (data.error === "trial_expired") {
        const err = new Error(data.message || "Your free trial has ended. Visit getclipd.ca to subscribe.");
        err.trialExpired = true;
        err.upgradeUrl = data.upgrade_url || "https://getclipd.ca/pricing";
        throw err;
      }
      throw new Error(data.error || "Request failed");
    }
    return data;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") throw new Error("Request timed out — check your connection");
    throw err;
  }
}

export const api = {
  adminLogin: (slug, password) =>
    request("/api/mobile/admin-login", { method: "POST", body: JSON.stringify({ slug, password }) }),
  staffLogin: (email, password) =>
    request("/api/mobile/staff-login", { method: "POST", body: JSON.stringify({ email, password }) }),
  adminSignup: (data) => request("/api/mobile/admin-signup", { method: "POST", body: JSON.stringify(data) }),
  logout: () => request("/api/mobile/logout", { method: "POST" }),

  adminToday: () => request("/api/admin/today"),
  adminSchedule: (weekStart) => request(`/api/admin/schedule${weekStart ? `?week=${weekStart}` : ""}`),
  adminSlots: (date, barberId, serviceId) => request(`/api/admin/slots?date=${date}&barber_id=${barberId}&service_id=${serviceId || ""}`),
  adminCreateBooking: (data) => request("/api/admin/bookings", { method: "POST", body: JSON.stringify(data) }),
  adminCancelBooking: (code) => request(`/api/admin/bookings/${code}/cancel`, { method: "POST" }),
  adminUpdateBooking: (code, data) => request(`/api/admin/bookings/${code}`, { method: "PATCH", body: JSON.stringify(data) }),
  adminNoShow: (code) => request(`/api/admin/bookings/${code}/noshow`, { method: "POST" }),
  adminMarkPaid: (code, data) => request(`/api/admin/bookings/${code}/pay`, { method: "POST", body: JSON.stringify(data) }),
  adminBarbers: () => request("/api/admin/barbers"),
  adminServices: () => request("/api/admin/services"),
  adminAddService: (data) => request("/api/admin/services", { method: "POST", body: JSON.stringify(data) }),
  adminUpdateService: (id, data) => request(`/api/admin/services/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  adminDeleteService: (id) => request(`/api/admin/services/${id}`, { method: "DELETE" }),
  adminReorderServices: (order) => request("/api/admin/services/reorder", { method: "POST", body: JSON.stringify({ order }) }),
  // Compensation
  adminCompPlans: () => request("/api/admin/compensation/plans"),
  adminCreateCompPlan: (data) => request("/api/admin/compensation/plans", { method: "POST", body: JSON.stringify(data) }),
  adminUpdateCompPlan: (id, data) => request(`/api/admin/compensation/plans/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  adminDeleteCompPlan: (id) => request(`/api/admin/compensation/plans/${id}`, { method: "DELETE" }),
  adminAssignBarberPlan: (barberId, planId) => request(`/api/admin/barbers/${barberId}/plan`, { method: "POST", body: JSON.stringify({ plan_id: planId }) }),
  adminEarnings: (from, to) => request(`/api/admin/compensation/earnings?from=${from}&to=${to}`),
  adminBlocked: () => request("/api/admin/blocked"),
  adminBlockTime: (data) => request("/api/admin/blocked", { method: "POST", body: JSON.stringify(data) }),
  adminDeleteBlock: (id) => request(`/api/admin/blocked/${id}`, { method: "DELETE" }),
  adminClients: () => request("/api/admin/clients"),
  adminClientBookings: (email) => request(`/api/admin/clients/${encodeURIComponent(email)}/bookings`),
  adminClientNotes: (email) => request(`/api/admin/clients/${encodeURIComponent(email)}/notes`),
  adminSaveNotes: (email, notes) =>
    request(`/api/admin/clients/${encodeURIComponent(email)}/notes`, { method: "POST", body: JSON.stringify({ notes }) }),
  adminInsights: (from, to) => {
    const qs = from && to ? `?from=${from}&to=${to}` : "";
    return request(`/api/admin/insights${qs}`);
  },
  adminRevenueChart: (from, to) => request(`/api/admin/insights/revenue-chart?from=${from}&to=${to}`),
  adminHeatmap: (from, to) => {
    const qs = from && to ? `?from=${from}&to=${to}` : "";
    return request(`/api/admin/insights/heatmap${qs}`);
  },
  adminSettings: () => request("/api/admin/settings"),
  adminSaveInfo: (data) => request("/api/admin/settings/info", { method: "POST", body: JSON.stringify(data) }),
  adminSaveHours: (hours) => request("/api/admin/settings/hours", { method: "POST", body: JSON.stringify({ hours }) }),
  adminSavePassword: (current, newPw) =>
    request("/api/admin/settings/password", { method: "POST", body: JSON.stringify({ current, new: newPw }) }),
  adminPaymentSettings: () => request("/api/admin/payment-settings"),
  adminSavePaymentSettings: (data) => request("/api/admin/payment-settings", { method: "POST", body: JSON.stringify(data) }),

  adminUpload: async (uri, type, barberId) => {
    const token = await getToken();
    const form = new FormData();
    form.append("file", { uri, type: "image/jpeg", name: "photo.jpg" });
    form.append("type", type);
    if (barberId) form.append("barber_id", String(barberId));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(`${BASE_URL}/api/admin/upload`, {
        method: "POST",
        headers: { "X-Mobile-Token": token },
        body: form,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      return data;
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === "AbortError") throw new Error("Upload timed out");
      throw err;
    }
  },
  adminBarberAdd: (data) => request("/api/admin/barbers", { method: "POST", body: JSON.stringify(data) }),
  adminBarberDelete: (id) => request(`/api/admin/barbers/${id}`, { method: "DELETE" }),
  adminBarberUpdate: (id, data) => request(`/api/admin/barbers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  adminBarberBio: (id, data) => request(`/api/admin/barbers/${id}/bio`, { method: "POST", body: JSON.stringify(data) }),
  adminBarberAvailability: (id) => request(`/api/admin/barbers/${id}/availability`),
  adminSetBarberAvailability: (id, days) => request(`/api/admin/barbers/${id}/availability`, { method: "POST", body: JSON.stringify({ days }) }),
  adminBarberServices: (id) => request(`/api/admin/barbers/${id}/services`),
  adminSetBarberServices: (id, serviceIds) => request(`/api/admin/barbers/${id}/services`, { method: "POST", body: JSON.stringify({ service_ids: serviceIds }) }),
  adminBarberInvite: (id) => request(`/api/admin/barbers/${id}/invite`, { method: "POST" }),
  adminClientVip: (email, isVip) => request(`/api/admin/clients/${encodeURIComponent(email)}/vip`, { method: "POST", body: JSON.stringify({ is_vip: isVip }) }),

  staffSchedule: () => request("/api/staff/schedule"),
  staffBookings: (data) => request("/api/staff/bookings", { method: "POST", body: JSON.stringify(data) }),
  staffNoShow: (code) => request(`/api/staff/bookings/${code}/noshow`, { method: "POST" }),
  staffCancelBooking: (code) => request(`/api/staff/bookings/${code}/cancel`, { method: "POST" }),
  staffBlocked: () => request("/api/staff/blocked"),
  staffBlockTime: (data) => request("/api/staff/blocked", { method: "POST", body: JSON.stringify(data) }),
  staffDeleteBlock: (id) => request(`/api/staff/blocked/${id}`, { method: "DELETE" }),
  staffStats: () => request("/api/staff/stats"),
  staffClientBookings: (email) => request(`/api/staff/clients/${encodeURIComponent(email)}/bookings`),
  staffClientNotes: (email) => request(`/api/staff/clients/${encodeURIComponent(email)}/notes`),
  staffSaveNotes: (email, notes) =>
    request(`/api/staff/clients/${encodeURIComponent(email)}/notes`, { method: "POST", body: JSON.stringify({ notes }) }),
};
