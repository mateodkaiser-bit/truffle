import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

/** Team login. Accounts only see data when their email is on the crm_team list. */
export function CrmLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState("");

  const withPassword = async (e: FormEvent) => {
    e.preventDefault();
    setState("busy");
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setState("idle");
    if (error) setError(error.message);
  };

  const withLink = async () => {
    if (!email) return setError("Fill in your email first.");
    setState("busy");
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/crm`, shouldCreateUser: true },
    });
    if (error) {
      setState("idle");
      setError(error.message);
    } else setState("sent");
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <form
        onSubmit={withPassword}
        className="w-full max-w-sm space-y-3 rounded-2xl border bg-card p-6 shadow-soft"
      >
        <h1 className="text-2xl">Truffle CRM</h1>
        <p className="text-sm text-muted-foreground">Team only. Sign in once per device.</p>
        <Input
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" className="w-full" disabled={state === "busy" || !password}>
          Sign in
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={state === "busy"}
          onClick={withLink}
        >
          Email me a login link
        </Button>
        {state === "sent" && <p className="text-sm">Check your inbox for the link.</p>}
        {error && <p className="text-sm text-ember">{error}</p>}
      </form>
    </main>
  );
}
