// Sign-in for the local CRM scripts (crm-import.ts and friends), without a login link every run.
//
//   bun scripts/crm-session.ts login     # once per Mac: sign in, keep the session in the macOS Keychain
//   bun scripts/crm-session.ts status    # who the stored session is, and whether it still works
//   bun scripts/crm-session.ts logout    # end the session on the server and remove it from the Keychain
//
// The Keychain holds only a Supabase refresh token (service "truffle-crm"), never a password or the
// team link secret. Each run swaps it for a fresh one, so a copied token stops working after the
// next run. Revoke it with `logout`, or for a team-link session by deleting its row from
// crm_link_members (see scripts/sql/crm-roles-and-audit.sql). Nothing is written to the repo or .env.
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { createClient } from "@supabase/supabase-js";

const env = (k: string, d = "") => process.env[k] ?? d;
const SERVICE = "truffle-crm";
const ACCOUNT = env("CRM_KEYCHAIN_ACCOUNT", "import-session");

type Sb = ReturnType<typeof createClient>;

function keychainGet(): string | null {
  const r = spawnSync("security", ["find-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w"], {
    encoding: "utf8",
  });
  return r.status === 0 ? r.stdout.trim() || null : null;
}

function keychainSet(token: string) {
  const r = spawnSync("security", [
    "add-generic-password",
    "-U",
    "-s",
    SERVICE,
    "-a",
    ACCOUNT,
    "-l",
    "Truffle CRM import session",
    "-w",
    token,
  ]);
  if (r.status !== 0) throw new Error("Could not store the CRM session in the Keychain.");
}

function keychainDelete() {
  spawnSync("security", ["delete-generic-password", "-s", SERVICE, "-a", ACCOUNT]);
}

/** A Supabase client for scripts: session in memory only, no automatic refresh. */
export function crmClient(): Sb {
  const url = env("VITE_SUPABASE_URL") || env("SUPABASE_URL");
  const key = env("VITE_SUPABASE_PUBLISHABLE_KEY") || env("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !key)
    throw new Error("Run from ~/truffle so Bun loads .env (Supabase URL and publishable key).");
  const memory = new Map<string, string>();
  return createClient(url, key, {
    auth: {
      flowType: "pkce",
      autoRefreshToken: false,
      storage: {
        getItem: (k) => memory.get(k) ?? null,
        setItem: (k, v) => void memory.set(k, v),
        removeItem: (k) => void memory.delete(k),
      },
    },
  });
}

/**
 * Interactive sign-in: the team link secret from CRM_JOIN_SECRET, a password from
 * TRUFFLE_CRM_PASSWORD, otherwise an emailed login link that lands on a small server on this
 * machine (or you paste the address it opened).
 */
export async function interactiveSignIn(sb: Sb) {
  const joinSecret = env("CRM_JOIN_SECRET");
  if (joinSecret) {
    const { error } = await sb.auth.signInAnonymously();
    if (error) throw error;
    const { data, error: joinError } = await sb.rpc("join_crm", { secret: joinSecret });
    if (joinError) throw joinError;
    if (data !== true) throw new Error("CRM_JOIN_SECRET does not match the current team link.");
    return;
  }
  const email = (env("TRUFFLE_CRM_EMAIL") || prompt("Your team email:") || "").trim().toLowerCase();
  if (!email) throw new Error("No email given.");
  const password = env("TRUFFLE_CRM_PASSWORD");
  if (password) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return;
  }
  const port = Number(env("CRM_LOGIN_PORT", "8789"));
  let fromServer: (code: string) => void = () => {};
  const served = new Promise<string>((r) => (fromServer = r));
  const server = Bun.serve({
    port,
    fetch(req) {
      const code = new URL(req.url).searchParams.get("code");
      if (!code) return new Response("No login code in this link.", { status: 400 });
      fromServer(code);
      return new Response("Signed in. Close this tab and go back to the terminal.");
    },
  });
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `http://localhost:${port}/`, shouldCreateUser: true },
  });
  if (error) throw error;
  console.log(
    `Login link sent to ${email}. Open it on this Mac.\n` +
      "If it opens the Truffle site instead of a 'Signed in' page, copy the full address from the " +
      "address bar and paste it here.",
  );
  const rl = createInterface({ input: process.stdin });
  const pasted = new Promise<string>((r) =>
    rl.on("line", (line) => {
      const code = line.match(/[?&]code=([^&#\s]+)/)?.[1];
      if (code) r(decodeURIComponent(code));
      else console.log("No code in that address; paste the whole URL.");
    }),
  );
  const code = await Promise.race([served, pasted]);
  rl.close();
  await server.stop();
  const { error: exchangeError } = await sb.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
}

/** Keep the current session's (rotated) refresh token for the next run. */
export async function rememberSession(sb: Sb) {
  const { data } = await sb.auth.getSession();
  if (data.session?.refresh_token) keychainSet(data.session.refresh_token);
}

/**
 * Sign in for a script run: the stored session if there is one, otherwise interactively (and then
 * keep that session). Returns true when the stored session was used.
 */
export async function scriptSignIn(sb: Sb): Promise<boolean> {
  const stored = keychainGet();
  if (stored) {
    const { data, error } = await sb.auth.refreshSession({ refresh_token: stored });
    if (!error && data.session) {
      keychainSet(data.session.refresh_token);
      return true;
    }
    console.warn(`Stored CRM session no longer works (${error?.message ?? "no session"}).`);
    if (!process.stdin.isTTY && !env("CRM_JOIN_SECRET") && !env("TRUFFLE_CRM_PASSWORD"))
      throw new Error("Run `bun scripts/crm-session.ts login` once in a terminal.");
  }
  await interactiveSignIn(sb);
  await rememberSession(sb);
  return false;
}

/** End a run: keep the stored session alive (no server sign-out), only save the latest token. */
export async function endScriptSession(sb: Sb) {
  await rememberSession(sb);
}

async function main(cmd: string) {
  const sb = crmClient();
  if (cmd === "login") {
    keychainDelete();
    await interactiveSignIn(sb);
  } else if (cmd === "logout") {
    const stored = keychainGet();
    if (stored) {
      const { error } = await sb.auth.refreshSession({ refresh_token: stored });
      if (!error) await sb.auth.signOut();
    }
    keychainDelete();
    console.log("Signed out and removed the stored CRM session.");
    return;
  } else if (cmd === "status") {
    if (!keychainGet())
      return console.log("No stored CRM session. Run: bun scripts/crm-session.ts login");
    await scriptSignIn(sb);
  } else {
    return console.log("Usage: bun scripts/crm-session.ts login | status | logout");
  }
  const { data: user } = await sb.auth.getUser();
  const { data: member } = await sb.rpc("is_crm_member");
  if (cmd === "login") await rememberSession(sb);
  console.log(
    `Session: ${user.user?.email || "team link device"} (user id ${user.user?.id}). ` +
      `CRM member: ${member === true ? "yes" : "NO"}. Stored in the Keychain as ${SERVICE}/${ACCOUNT}.`,
  );
}

if (import.meta.main) await main(process.argv[2] ?? "");
