import { NextResponse } from "next/server";

// Auth is disabled — return a static local-dev session immediately.
// This specific route takes priority over the [...nextauth] catch-all,
// eliminating all DB/JWT work on session fetches.
const STATIC_SESSION = {
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

export async function GET() {
  return NextResponse.json(STATIC_SESSION);
}
