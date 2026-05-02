import { db } from "@/server/db";
import NextAuth, { type DefaultSession, type Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      hasAccess: boolean;
      location?: string;
      role: string;
      isAdmin: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    hasAccess: boolean;
    role: string;
  }
}

const LOCAL_SESSION: Session = {
  user: {
    id: "local-dev-user",
    name: "Local Dev",
    email: "local-dev@example.com",
    image: null,
    hasAccess: true,
    role: "ADMIN",
    isAdmin: true,
  },
  expires: "2099-01-01T00:00:00.000Z",
};

const { auth: _nextAuth, handlers, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized() {
      // Auth is disabled — allow all requests
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.hasAccess = user.hasAccess;
        token.name = user.name;
        token.image = user.image;
        token.picture = user.image;
        token.location = (user as Session["user"]).location;
        token.role = user.role;
        token.isAdmin = user.role === "ADMIN";
      }

      // Handle updates
      if (trigger === "update" && (session as Session)?.user) {
        if (session) {
          token.name = (session as Session).user.name;
          token.image = (session as Session).user.image;
          token.picture = (session as Session).user.image;
          token.location = (session as Session).user.location;
          token.role = (session as Session).user.role;
          token.isAdmin = (session as Session).user.role === "ADMIN";
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.hasAccess = (token.hasAccess as boolean | undefined) ?? true;
      session.user.location = token.location as string;
      session.user.role = (token.role as string | undefined) ?? "ADMIN";
      session.user.isAdmin = token.role === "ADMIN";
      return session;
    },
  },

  providers: [
    CredentialsProvider({
      id: "local",
      name: "Local",
      credentials: {},
      async authorize() {
        await db.user.upsert({
          where: { id: "local-dev-user" },
          update: {
            email: "local-dev@example.com",
            hasAccess: true,
            name: "Local Dev",
            role: "ADMIN",
          },
          create: {
            id: "local-dev-user",
            email: "local-dev@example.com",
            hasAccess: true,
            interests: [],
            name: "Local Dev",
            role: "ADMIN",
          },
        });

        return {
          id: "local-dev-user",
          name: "Local Dev",
          email: "local-dev@example.com",
          image: null,
          hasAccess: true,
          role: "ADMIN",
        };
      },
    }),
  ],
});

// Always return a static local session — auth is disabled for this deployment
export const auth = async () => LOCAL_SESSION;
export { handlers, signIn, signOut };

