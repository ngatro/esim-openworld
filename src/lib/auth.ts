import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { generateAffiliateCode } from "./affiliate";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export async function createUser(name: string, email: string, password: string, referredById?: number | null) {
  const hashedPassword = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: "user",
      referredById,
      affiliateCode: await generateAffiliateCode(0), // Will be updated after create
    },
  });
  
  // Update with unique affiliate code
  const affiliateCode = await generateAffiliateCode(user.id);
  await prisma.user.update({
    where: { id: user.id },
    data: { affiliateCode },
  });
  
  return { ...user, affiliateCode };
}

export async function getUserByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  });
  return user;
}

export async function getUserById(id: number) {
  const user = await prisma.user.findUnique({
    where: { id },
  });
  return user;
}

export async function verifyLogin(email: string, password: string) {
  const user = await getUserByEmail(email);
  if (!user) return null;
  
  const isValid = await verifyPassword(password, user.password);
  if (!isValid) return null;
  
  return user;
}

// Get session from request cookies (NextAuth or custom token)
export async function getSessionFromRequest(request: Request) {
  // Try NextAuth session token first
  const nextAuthSession = request.headers.get("cookie")?.match(/next-auth.session-token=([^;]+)/)?.[1];
  if (nextAuthSession) {
    try {
      const parts = nextAuthSession.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
        if (payload.email) {
          const user = await prisma.user.findUnique({
            where: { email: payload.email },
            select: { id: true, email: true, name: true, role: true },
          });
          if (user) {
            return { user };
          }
        }
      }
    } catch (e) {
      console.error("Failed to decode JWT:", e);
    }
  }
  
  // Fallback to custom auth token
  const cookie = request.headers.get("cookie");
  const token = cookie?.match(/auth-token=([^;]+)/)?.[1];
  
  if (token) {
    const userId = parseInt(token);
    if (!isNaN(userId)) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, role: true },
      });
      if (user) {
        return { user };
      }
    }
  }
  
  return null;
}
