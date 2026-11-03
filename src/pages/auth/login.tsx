import Button from "@/components/ui/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { loginSchema } from "./schema";
import { InputField } from "@/components/ui/input";
import { useLogin } from "./hooks";
import { useAuth } from "@/hooks/useAuth";
import { url } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import garageLogo from "@/assets/garage-logo.svg";

/** Decorative bay board: empty slots only, it carries no status. */
const BayBoard = () => (
  <svg
    viewBox="0 0 320 56"
    preserveAspectRatio="xMinYMid meet"
    aria-hidden
    className="h-auto w-full max-w-sm text-base-content/30"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    {Array.from({ length: 8 }, (_, i) => (
      <rect key={i} x={1 + i * 40} y="1" width="34" height="54" rx="4" />
    ))}
  </svg>
);

export default function LoginPage() {
  const auth = useAuth();
  const [params] = useSearchParams();
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });
  const login = useLogin();
  const error = params.get("error");

  return (
    <div className="grid min-h-full lg:grid-cols-[1.15fr_1fr]">
      <section className="flex flex-col justify-between gap-10 p-6 sm:p-10 lg:p-16">
        <div className="flex items-center gap-4">
          <img
            src={garageLogo}
            alt=""
            className="h-14 w-14 rounded-lg bg-white p-1.5"
          />
          <p className="text-xl font-extrabold tracking-tight">Garage</p>
        </div>
        <div className="max-w-xl">
          <h1 className="display">
            Know the cluster before you touch the data.
          </h1>
          <p className="muted mt-6 max-w-md text-base leading-relaxed">
            Quorum, nodes, buckets and access keys for your Garage object
            storage, in one private console.
          </p>
        </div>
        <BayBoard />
      </section>
      <section className="flex items-center justify-center border-t border-base-300 bg-base-100 p-6 sm:p-10 lg:border-l lg:border-t-0 lg:p-16">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-extrabold tracking-tight">Sign in</h2>
          <p className="muted mb-8 mt-2 text-sm">
            {auth.oidcEnabled && !auth.localEnabled
              ? "Use your organization account to continue."
              : "Enter your administrator credentials to continue."}
          </p>
          {error && (
            <p
              role="alert"
              className="mb-6 rounded-lg border border-error/40 bg-error/10 p-4 text-sm"
            >
              {error === "access_denied"
                ? "Your account does not belong to an allowed administrator group."
                : "SSO sign-in failed or expired. Please try again."}
            </p>
          )}
          {auth.oidcEnabled && (
            <a
              href={url("/api/auth/oidc/login")}
              className="btn btn-primary w-full"
            >
              Continue with SSO <ArrowRight size={18} aria-hidden />
            </a>
          )}
          {auth.localEnabled && (
            <form
              onSubmit={form.handleSubmit((value) => login.mutate(value))}
              className="space-y-4"
            >
              <InputField
                form={form}
                name="username"
                title="Username"
                autoComplete="username"
                className="w-full"
              />
              <InputField
                form={form}
                name="password"
                title="Password"
                type="password"
                autoComplete="current-password"
                className="w-full"
              />
              <Button
                type="submit"
                color="primary"
                className="mt-2 w-full"
                loading={login.isPending}
              >
                Sign in
              </Button>
            </form>
          )}
          {!auth.oidcEnabled && !auth.localEnabled && (
            <p
              role="alert"
              className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm"
            >
              Sign-in is not configured. Contact your administrator.
            </p>
          )}
          <p className="muted mt-8 text-xs leading-relaxed">
            Access is restricted to authorized administrators.
          </p>
        </div>
      </section>
    </div>
  );
}
