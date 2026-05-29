"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed.");
        return;
      }
      // Auto sign in after registration
      await signIn("credentials", { email: form.email, password: form.password, redirect: false });
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🃏</div>
          <h1 className="text-3xl font-bold text-white mb-2">AgakPoints</h1>
          <p className="text-white/50 text-sm">Create your admin account</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
          <h2 className="text-white font-semibold mb-5">Register</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Name</label>
              <Input
                placeholder="Your name"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Email</label>
              <Input
                type="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Password</label>
              <Input
                type="password"
                placeholder="Min 8 characters"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Confirm Password</label>
              <Input
                type="password"
                placeholder="Repeat password"
                value={form.confirm}
                onChange={(e) => update("confirm", e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account"}
            </Button>
          </form>

          <p className="text-center text-white/30 text-sm mt-4">
            Already have an account?{" "}
            <Link href="/login" className="text-violet-400 hover:text-violet-300">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
