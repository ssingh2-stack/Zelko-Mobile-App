import { api } from "./api";

// Fetch connection token from our backend for the Stripe Terminal SDK
export async function fetchConnectionToken() {
  const result = await api.adminTerminalToken();
  return result.secret;
}
