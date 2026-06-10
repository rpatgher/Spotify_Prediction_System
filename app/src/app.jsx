// ============================================================
// App — hash router + simulated session guard
// ============================================================
const { useState: useStateApp, useEffect: useEffectApp } = React;

const ROUTES = ["/login", "/user", "/producer", "/results", "/history"];

function useHashRoute() {
  const read = () => {
    const h = window.location.hash.replace(/^#/, "");
    return ROUTES.includes(h) ? h : "";
  };
  const [route, setRoute] = useStateApp(read() || "/login");
  useEffectApp(() => {
    const on = () => setRoute(read() || "/login");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const navigate = (to) => {
    if (("#" + to) !== window.location.hash) window.location.hash = to;
    else setRoute(to);
  };
  return [route, navigate];
}

function App() {
  const [route, navigate] = useHashRoute();
  const [session, setSession] = useStateApp(() => mockAnalysisService.getSession());
  const [loading, setLoading] = useStateApp(false);
  const [, force] = useStateApp(0); // bump to refresh after saving analysis

  // ---- session guards -------------------------------------------------
  useEffectApp(() => {
    const authed = !!session;
    if (!authed && route !== "/login") { navigate("/login"); return; }
    if (authed && route === "/login") { navigate(session.role === "producer" ? "/producer" : "/user"); return; }
    // keep roles on their own dashboard
    if (authed && route === "/producer" && session.role !== "producer") navigate("/user");
    if (authed && route === "/user" && session.role === "producer") navigate("/producer");
  }, [route, session]);

  const handleLogin = (s) => { mockAnalysisService.setSession(s); setSession(s); };
  const handleLogout = () => { mockAnalysisService.clearSession(); setSession(null); navigate("/login"); };

  // ---- login (no shell) ----------------------------------------------
  if (!session || route === "/login") {
    return <LoginPage navigate={navigate} onLogin={handleLogin} />;
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

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
