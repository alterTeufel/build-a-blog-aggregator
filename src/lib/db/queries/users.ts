import { eq } from "drizzle-orm";

import { db } from "../index.js";
import { users } from "../schema.js";

export async function createUser(name: string) {
  const [result] = await db
    .insert(users)
    .values({ name })
    .returning();

  if (!result) {
    throw new Error("Failed to create user");
  }

  return result;
}

export async function getUserByName(name: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.name, name));

  return user;
}

export async function deleteAllUsers(): Promise<void> {
  await db.delete(users);
}

export async function getUsers() {
  return db.select().from(users);
}
