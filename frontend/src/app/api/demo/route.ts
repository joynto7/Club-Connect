import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message: "This is a demo API response from the Next.js frontend.",
    timestamp: new Date().toISOString(),
  });
}
