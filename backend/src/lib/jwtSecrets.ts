import type { Secret } from "jsonwebtoken";

function required(name: string): Secret {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set — refusing to start with a guessable default`);
  }
  return value;
}

export const accessTokenSecret: Secret = required("JWT_ACCESS_TOKEN_SECRET");
export const refreshTokenSecret: Secret = required("JWT_REFRESH_TOKEN_SECRET");
