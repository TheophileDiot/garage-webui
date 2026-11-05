import Button from "@/components/ui/button";
import { buttonClass } from "@/components/ui/button-styles";
import { InputField } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import ThemeChoice from "@/components/shell/theme-choice";
import Page from "@/context/page-context";
import { useAuth } from "@/hooks/useAuth";
import { url } from "@/lib/utils";
import garageLogo from "@/assets/garage-logo.svg";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LogIn } from "lucide-react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { useLogin } from "./hooks";
import { loginSchema } from "./schema";

export default function LoginPage() {
  const auth = useAuth();
  const [params] = useSearchParams();
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });
  const login = useLogin();
  const error = params.get("error");

  const ssoOnly = auth.oidcEnabled && !auth.localEnabled;
  const ssoClass = buttonClass({
    variant: ssoOnly ? "primary" : "secondary",
    className: "w-full",
  });

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-4 py-10">
      <Page title="Sign in" />
      <a href="#signin" className="skip-link">
        Skip to sign in
      </a>

      <div className="flex items-center gap-2.5" aria-hidden>
        <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-brand">
          <img src={garageLogo} alt="" width={28} height={28} />
        </span>
        <span>
          <span className="block font-cond text-[22px] font-semibold leading-none">
            Garage
          </span>
          <span className="mt-1 block text-caption text-ink-3">
            Storage console
          </span>
        </span>
      </div>

      <main
        id="signin"
        tabIndex={-1}
        className="grid w-full max-w-[24rem] gap-5 rounded-xl border border-line bg-surface p-6 outline-none"
      >
        <div>
          <h1 className="font-cond text-[26px] font-semibold leading-tight">
            Sign in
          </h1>
          <p className="mt-1.5 text-ink-3">
            {ssoOnly
              ? "Use your organization account to continue."
              : "Enter your administrator credentials to continue."}
          </p>
        </div>

        {error ? (
          <Notice tone="bad" alert>
            {error === "access_denied"
              ? "Your account does not belong to an allowed administrator group."
              : "SSO sign-in failed or expired. Please try again."}
          </Notice>
        ) : null}

        {auth.localEnabled ? (
          <form
            onSubmit={form.handleSubmit((value) => login.mutate(value))}
            className="grid gap-4"
            noValidate
          >
            <InputField
              form={form}
              name="username"
              title="Username"
              autoComplete="username"
              spellCheck={false}
            />
            <InputField
              form={form}
              name="password"
              title="Password"
              type="password"
              autoComplete="current-password"
            />
            <Button
              type="submit"
              variant="primary"
              icon={LogIn}
              className="w-full"
              loading={login.isPending}
            >
              Sign in
            </Button>
          </form>
        ) : null}

        {auth.localEnabled && auth.oidcEnabled ? (
          <div className="flex items-center gap-3 text-ink-3" aria-hidden>
            <span className="h-px flex-1 bg-line-strong" />
            or
            <span className="h-px flex-1 bg-line-strong" />
          </div>
        ) : null}

        {auth.oidcEnabled ? (
          <a href={url("/api/auth/oidc/login")} className={ssoClass}>
            Continue with SSO <ArrowRight size={16} aria-hidden />
          </a>
        ) : null}

        {!auth.oidcEnabled && !auth.localEnabled ? (
          <Notice tone="warn" alert>
            Sign-in is not configured. Contact your administrator.
          </Notice>
        ) : null}

        <p className="text-caption text-ink-3">
          Access is restricted to authorized administrators.
        </p>
      </main>

      <div className="w-full max-w-[24rem]">
        <p className="lbl pb-1.5">Theme</p>
        <ThemeChoice />
      </div>
    </div>
  );
}
