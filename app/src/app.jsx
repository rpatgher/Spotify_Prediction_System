// ============================================================
// App — hash router + Keycloak session guard
// ============================================================
import React, { useState as useStateApp, useEffect as useEffectApp } from "react";
import keycloak, { sessionFromToken, APP_BASE_URL } from "./keycloak.js";
import { AppLayout } from "./layout.jsx";
import { WelcomePage } from "./pages-welcome.jsx";
import { UserDashboardPage, ProducerDashboardPage } from "./pages-dashboard.jsx";
import { ResultsPage } from "./pages-results.jsx";
import { HistoryPage } from "./pages-history.jsx";

const ROUTES = ["/welcome", "/user", "/producer", "/results", "/history"];

function useHashRoute() {
  const read = () => {
    const h = window.location.hash.replace(/^#/, "");
    return ROUTES.includes(h) ? h : "";
  };
  const [route, setRoute] = useStateApp(read() || "/welcome");
  useEffectApp(() => {
    const on = () => setRoute(read() || "/welcome");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const navigate = (to) => {
    if (("#" + to) !== window.location.hash) window.location.hash = to;
    else setRoute(to);
  };
  return [route, navigate];
}

export default function App() {
  const [route, navigate] = useHashRoute();
  const session = sessionFromToken(keycloak); // resolved by keycloak.init() before render
  const [loading, setLoading] = useStateApp(false);
  const [, force] = useStateApp(0); // bump to refresh after saving analysis

  // ---- session guards -------------------------------------------------
  useEffectApp(() => {
    if (!session) {
      if (route !== "/welcome") navigate("/welcome");
      return;
    }
    if (route === "/welcome") { navigate(session.role === "producer" ? "/producer" : "/user"); return; }
    // keep roles on their own dashboard
    if (route === "/producer" && session.role !== "producer") navigate("/user");
    if (route === "/user" && session.role === "producer") navigate("/producer");
  }, [route, session]);

  const handleLogin = () => keycloak.login({ redirectUri: APP_BASE_URL });
  const handleLogout = () => keycloak.logout({ redirectUri: APP_BASE_URL });

  // ---- welcome (no shell) ----------------------------------------------
  if (!session) {
    return <WelcomePage onStart={handleLogin} />;
  }

  // ---- authed shell ---------------------------------------------------
  let page = null;
  if (route === "/user") page = <UserDashboardPage navigate={navigate} loading={loading} setLoading={setLoading} onResult={() => force((n) => n + 1)} />;
  else if (route === "/producer") page = <ProducerDashboardPage navigate={navigate} loading={loading} setLoading={setLoading} onResult={() => force((n) => n + 1)} />;
  else if (route === "/results") page = <ResultsPage navigate={navigate} session={session} />;
  else if (route === "/history") page = <HistoryPage navigate={navigate} session={session} />;
  else page = <UserDashboardPage navigate={navigate} loading={loading} setLoading={setLoading} onResult={() => force((n) => n + 1)} />;

  return (
    <AppLayout session={session} route={route} navigate={navigate} onLogout={handleLogout}>
      {page}
    </AppLayout>
  );
}
