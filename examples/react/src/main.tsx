import { StrictMode, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { useAuth } from "./auth";

function App() {
  const { state, signIn, signUp, signOut } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");

  if (state.status === "loading") return <p>Loading...</p>;

  if (state.status === "authenticated") {
    return (
      <div>
        <p>Signed in as <strong>{state.user.username}</strong></p>
        <p>Role: {state.user.role}</p>
        <button onClick={signOut}>Sign out</button>
      </div>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === "login") signIn(username, password);
    else signUp(username, password);
  };

  return (
    <form onSubmit={submit}>
      <h1>{mode === "login" ? "Sign in" : "Create account"}</h1>
      <input
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {state.status === "error" && <p>{state.error}</p>}
      <button type="submit">{mode === "login" ? "Sign in" : "Create account"}</button>
      <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
