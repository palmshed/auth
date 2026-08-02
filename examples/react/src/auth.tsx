import { AuthClient, type AuthState, type User } from "@palmshed/auth-client";
import { useState, useEffect, useCallback } from "react";

const client = new AuthClient({
  baseUrl: "http://localhost:3000",
  storageKey: "session",
  refreshKey: "session_refresh",
});

export function useAuth() {
  const [state, setState] = useState<AuthState>(client.state);

  useEffect(() => {
    const unsub = client.addInterceptor(() => {});
    return unsub;
  }, []);

  useEffect(() => {
    if (client.isAuthenticated()) {
      client.getSession().then((result) => {
        if (!result.ok) setState({ status: "unauthenticated" });
      });
    } else {
      setState({ status: "unauthenticated" });
    }
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const result = await client.signIn(username, password);
    if (result.ok) setState({ status: "authenticated", user: result.data.user, token: result.data.token });
    return result;
  }, []);

  const signUp = useCallback(async (username: string, password: string, email?: string) => {
    return client.signUp(username, password, email);
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
