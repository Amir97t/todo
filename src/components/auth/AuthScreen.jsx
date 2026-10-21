import { useState } from "react";
import { useAuth } from "../../context/AuthContext.js";

export default function AuthScreen() {
  const { login, register, error, clearError, restoreSession } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState("");

  const isRegister = mode === "register";

  async function handleSubmit(event) {
    event.preventDefault();
    setPending(true);
    setFormError("");
    clearError();

    try {
      if (isRegister) await register({ email: email.trim(), password });
      else await login({ email: email.trim(), password });
    } catch (cause) {
      setFormError(cause?.message || "Authentication failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleRetry() {
    setPending(true);
    await restoreSession();
    setPending(false);
  }

  return (
    <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/80 p-7 shadow-2xl backdrop-blur-xl sm:p-9">
        <div className="mb-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-sky-300">Tasknote</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            {isRegister ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {isRegister
              ? "Create an account to keep your tasks synced securely."
              : "Sign in to continue to your tasks."}
          </p>
        </div>

        {(formError || error) && (
          <div role="alert" className="mb-5 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            {formError || error}
            {error && !formError && (
              <button type="button" onClick={handleRetry} disabled={pending} className="ml-2 underline underline-offset-4 disabled:opacity-50">
                Retry
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="auth-email" className="mb-2 block text-sm font-medium text-slate-200">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="mb-2 block text-sm font-medium text-slate-200">Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              minLength={8}
              maxLength={72}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
              placeholder={isRegister ? "At least 8 characters" : "Your password"}
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-sky-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          {isRegister ? "Already have an account?" : "New to Tasknote?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(isRegister ? "login" : "register");
              setFormError("");
              clearError();
            }}
            className="font-medium text-sky-300 underline-offset-4 hover:underline"
          >
            {isRegister ? "Sign in" : "Create an account"}
          </button>
        </p>
      </section>
    </main>
  );
}
