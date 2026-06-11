// ============================================================
// App — hash router + simulated session guard
// ============================================================
const { useState: useStateApp, useEffect: useEffectApp } = React;

const ROUTES = ["/welcome", "/login", "/user", "/producer", "/results", "/history"];

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

function App() {
  const [route, navigate] = useHashRoute();
  const [session, setSession] = useStateApp(() => mockAnalysisService.getSession());
  const [loading, setLoading] = useStateApp(false);
  const [, force] = useStateApp(0); // bump to refresh after saving analysis

  // ---- session guards -------------------------------------------------
  useEffectApp(() => {
    const authed = !!session;
    if (!authed) {
      if (route !== "/login" && route !== "/welcome") navigate("/welcome");
      return;
    }
    if (route === "/login" || route === "/welcome") { navigate(session.role === "producer" ? "/producer" : "/user"); return; }
    // keep roles on their own dashboard
    if (route === "/producer" && session.role !== "producer") navigate("/user");
    if (route === "/user" && session.role === "producer") navigate("/producer");
  }, [route, session]);

  const handleLogin = (s) => { mockAnalysisService.setSession(s); setSession(s); };
  const handleLogout = () => { mockAnalysisService.clearSession(); setSession(null); navigate("/login"); };

  // ---- welcome / login (no shell) -------------------------------------
  if (!session) {
    if (route === "/login") return <LoginPage navigate={navigate} onLogin={handleLogin} />;
    return <WelcomePage navigate={navigate} />;
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
