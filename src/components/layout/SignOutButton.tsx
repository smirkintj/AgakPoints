"use client";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-sm text-white/50 hover:text-white transition-colors"
    >
      Sign out
    </button>
  );
}
