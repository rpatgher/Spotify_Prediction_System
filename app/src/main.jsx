import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app.jsx";
import keycloak from "./keycloak.js";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root"));

// check-sso: resolve the session (if any) before rendering, but never
// force a login — the welcome page stays public.
keycloak
  .init({ onLoad: "check-sso", pkceMethod: "S256" })
  .then(() => root.render(<App />))
  .catch((err) => {
    console.error("Keycloak init failed", err);
    root.render(<App />); // render unauthenticated rather than a blank page
  });
