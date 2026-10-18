import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — Goalmaster" },
      { name: "description", content: "Créez votre compte Goalmaster et commencez votre collection de cartes de football." },
      { property: "og:title", content: "Connexion — Goalmaster" },
      { property: "og:description", content: "Rejoignez Goalmaster et ouvrez vos premiers packs." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const { session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) navigate({ to: "/packs" });
  }, [session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { username } },
        });
        if (error) throw error;
        if (!data.session) toast.success("Vérifiez votre e-mail pour confirmer votre compte.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error(r.error.message);
  }

  const input = "w-full rounded-lg border border-input bg-background/60 px-3 py-2.5 text-foreground outline-none focus:border-primary";
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="panel w-full max-w-sm p-6 shadow-gold">
        <h1 className="text-center text-4xl text-gold">{mode === "in" ? "Connexion" : "Inscription"}</h1>
        <form onSubmit={submit} className="mt-6 space-y-3">
          {mode === "up" && (
            <input className={input} placeholder="Pseudo" required value={username} onChange={(e) => setUsername(e.target.value)} />
          )}
          <input className={input} type="email" placeholder="E-mail" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={input} type="password" placeholder="Mot de passe" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
          <button disabled={busy} className="w-full rounded-lg bg-gold py-2.5 font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50">
            {mode === "in" ? "Se connecter" : "Créer mon compte"}
          </button>
        </form>
        <button onClick={google} className="mt-3 w-full rounded-lg border border-border py-2.5 font-semibold text-foreground hover:bg-secondary">
          Continuer avec Google
        </button>
        <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-4 w-full text-sm text-muted-foreground hover:text-primary">
          {mode === "in" ? "Pas de compte ? Inscrivez-vous" : "Déjà inscrit ? Connectez-vous"}
        </button>
      </div>
    </div>
  );
}
