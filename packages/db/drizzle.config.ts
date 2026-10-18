import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
import path from "path";

// Explicitly resolve the .env file in the packages/db directory
dotenv.config({ path: path.resolve(__dirname, ".env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in packages/db/.env");
}
export default defineConfig({
  schema: "./src/schemas.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
