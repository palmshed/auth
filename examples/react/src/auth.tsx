import { AuthClient, type AuthState, type User } from "@palmshed/auth-client";
import { useState, useEffect, useCallback } from "react";

const client = new AuthClient({
  baseUrl: "http://localhost:3000",
  storageKey: "session",
  refreshKey: "session_refresh",
});

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    (async () => {
      if (!client.getToken()) {
        if (active) setState({ status: "unauthenticated" });
        return;
      }
      const result = await client.getSession();
      if (!active) return;
      if (result.ok) {
        setState({
          status: "authenticated",
          user: result.data.user,
          token: client.getToken() || "",
        });
      } else {
        setState({ status: "unauthenticated" });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const result = await client.signIn(username, password);
    if (result.ok) {
      setState({ status: "authenticated", user: result.data.user, token: result.data.token });
    } else {
      setState({ status: "error", error: result.error });
    }
    return result;
  }, []);

  const signUp = useCallback(async (username: string, password: string, email?: string) => {
    const result = await client.signUp(username, password, email);
    if (!result.ok) setState({ status: "error", error: result.error });
    return result;
  }, []);

  const signOut = useCallback(async () => {
    await client.signOut();
    setState({ status: "unauthenticated" });
  }, []);

  return { state, client, signIn, signUp, signOut };
}

export function AuthStatus({ user }: { user: User }) {
  return (
    <div>
      <p>Signed in as <strong>{user.username}</strong></p>
      <p>Role: {user.role}</p>
    </div>
  );
}
