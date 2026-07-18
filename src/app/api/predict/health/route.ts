import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const pool = await db();
    const { rows } = await pool.query(
      `SELECT
         (SELECT count(*) FROM players)     AS players,
         (SELECT count(*) FROM rounds)      AS rounds,
         (SELECT count(*) FROM predictions) AS predictions`
    );
    return NextResponse.json({ ok: true, tables: rows[0] });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
