import { SessionProvider } from "next-auth/react";
import type React from "react";
import { type ReactElement } from "react";

// Auth is disabled — provide a static local-dev session so SessionProvider
// never polls /api/auth/session.
const LOCAL_SESSION = {
  user: {
    id: "local-dev-user",
    name: "Local Dev",
    email: "local-dev@example.com",
    image: null as string | null,
    hasAccess: true,
    role: "ADMIN",
    isAdmin: true,
  },
  expires: "2099-01-01T00:00:00.000Z",
};

interface Props {
  children: React.ReactNode;
}

export default function NextAuthProvider({ children }: Props): ReactElement {
  return (
    <SessionProvider session={LOCAL_SESSION} refetchInterval={0} refetchOnWindowFocus={false}>
      {children}
    </SessionProvider>
  );
}
