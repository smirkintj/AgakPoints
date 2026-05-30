import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Simple in-process rate limit: max 5 attempts per IP per 15 minutes
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, email, password } = body as {
    name?: string;
    email?: string;
    password?: string;
  };

  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (name.trim().length > 100) {
    return NextResponse.json({ error: "Name too long" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name: name.trim(), email: email.trim().toLowerCase(), passwordHash },
    select: { id: true, email: true, name: true },
  });

  return NextResponse.json(user, { status: 201 });
}
