// ============================================================
// Keycloak singleton — config comes from Vite env (.env)
// ============================================================
import Keycloak from "keycloak-js";

export const APP_BASE_URL = import.meta.env.VITE_APP_BASE_URL || window.location.origin + "/";

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL,
  realm: import.meta.env.VITE_KEYCLOAK_REALM,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
});

// Map the Keycloak identity to the session shape the app already uses
// ({ name, role: "user" | "producer" }). The role comes from the realm
// roles in the token (productor/usuario).
export function sessionFromToken(kc) {
  if (!kc.authenticated || !kc.tokenParsed) return null;
  const roles = kc.tokenParsed.realm_access?.roles ?? [];
  return {
    name: kc.tokenParsed.name || kc.tokenParsed.preferred_username || "Usuario",
    email: kc.tokenParsed.email || null,
    role: roles.includes("productor") ? "producer" : "user",
  };
}

export default keycloak;
