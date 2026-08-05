import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Wallet, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

type AuthError = { title: string; detail: string; hint?: string };

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [signInError, setSignInError] = useState<AuthError | null>(null);
  const [signUpError, setSignUpError] = useState<AuthError | null>(null);
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  function translateError(msg: string, code?: string): AuthError {
    const m = (msg || "").toLowerCase();
    const c = (code || "").toLowerCase();
    if (c === "weak_password" || m.includes("pwned") || m.includes("weak password") || m.includes("known to be weak")) {
      return {
        title: "Senha muito fraca ou vazada",
        detail: "Esta senha aparece em vazamentos públicos ou é fácil de adivinhar.",
        hint: "Use pelo menos 8 caracteres combinando letras maiúsculas, minúsculas, números e símbolos. Ex.: MinhaSenh@2026",
      };
    }
    if (c === "invalid_credentials" || m.includes("invalid login")) {
      return {
        title: "Email ou senha inválidos",
        detail: "Não encontramos uma conta com essas credenciais.",
        hint: "Verifique se digitou corretamente ou crie uma nova conta na aba 'Criar conta'.",
      };
    }
    if (c === "user_already_exists" || m.includes("already registered") || m.includes("user already")) {
      return {
        title: "Email já cadastrado",
        detail: "Este email já possui uma conta.",
        hint: "Vá para a aba 'Entrar' e faça login com sua senha.",
      };
    }
    if (m.includes("email") && m.includes("invalid")) {
      return { title: "Email inválido", detail: "Verifique o email informado." };
    }
    if (m.includes("rate limit") || m.includes("too many")) {
      return { title: "Muitas tentativas", detail: "Aguarde alguns minutos antes de tentar novamente." };
    }
    if (m.includes("network") || m.includes("failed to fetch")) {
      return {
        title: "Erro de conexão",
        detail: "Não foi possível conectar ao servidor de autenticação.",
        hint: "Verifique sua internet ou tente novamente pela URL publicada.",
      };
    }
    return { title: "Erro ao processar", detail: msg || "Ocorreu um erro inesperado." };
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setSignInError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      const err = translateError(error.message, (error as { code?: string }).code);
      setSignInError(err);
      return;
    }
    toast.success("Bem-vindo!");
    navigate({ to: "/", replace: true });
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setSignUpError(null);
    if (password.length < 8) {
      setSignUpError({
        title: "Senha muito curta",
        detail: "A senha precisa ter no mínimo 8 caracteres.",
        hint: "Combine letras maiúsculas, minúsculas, números e símbolos.",
      });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) {
      const err = translateError(error.message, (error as { code?: string }).code);
      setSignUpError(err);
      return;
    }
    toast.success("Conta criada! Entrando...");
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (!signInErr) navigate({ to: "/", replace: true });
  }

  async function handleGoogle() {
    setSignInError(null);
    setSignUpError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      const err = translateError(result.error.message ?? "Erro ao entrar com Google");
      if (tab === "signup") setSignUpError(err);
      else setSignInError(err);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/", replace: true });
  }

  function ErrorBox({ error }: { error: AuthError }) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{error.title}</AlertTitle>
        <AlertDescription>
          <p>{error.detail}</p>
          {error.hint && <p className="mt-1 text-xs opacity-90">{error.hint}</p>}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold">Fisio App</h1>
          <p className="text-sm text-muted-foreground">Controle de atendimentos</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Acessar</CardTitle>
            <CardDescription>Entre ou crie sua conta para começar.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => { setTab(v as "signin" | "signup"); setSignInError(null); setSignUpError(null); }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="mt-4">
                {signInError && <ErrorBox error={signInError} />}
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-in">Email</Label>
                    <Input id="email-in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pw-in">Senha</Label>
                    <Input id="pw-in" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    Entrar
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup" className="mt-4">
                {signUpError && <ErrorBox error={signUpError} />}
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-up">Email</Label>
                    <Input id="email-up" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pw-up">Senha</Label>
                    <Input
                      id="pw-up"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      aria-invalid={!!signUpError}
                    />
                    <p className="text-xs text-muted-foreground">
                      Mínimo 8 caracteres. Use letras, números e símbolos. Senhas comuns ou vazadas são bloqueadas.
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    Criar conta
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
            <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              ou
              <div className="h-px flex-1 bg-border" />
            </div>
            <Button variant="outline" className="w-full" onClick={handleGoogle}>
              Continuar com Google
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
