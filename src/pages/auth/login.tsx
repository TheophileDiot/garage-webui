import Button from "@/components/ui/button";
import {
  buttonBase,
  buttonSizes,
  buttonVariants,
} from "@/components/ui/button-styles";
import IconButton from "@/components/ui/icon-button";
import { InputField } from "@/components/ui/input";
import Page from "@/context/page-context";
import { useAuth } from "@/hooks/useAuth";
import { cn, url } from "@/lib/utils";
import appStore from "@/stores/app-store";
import garageLogo from "@/assets/garage-logo.svg";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LogIn, Moon, Sun } from "lucide-react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { useStore } from "zustand";
import { useLogin } from "./hooks";
import { loginSchema } from "./schema";

/** The anatomy of an S3 address, as a poster: scheme, bucket, key, with the delimiter that is only a convention. */
const Anatomy = () => (
  <figure className="m-0 grid gap-3" aria-label="Anatomy of an S3 address">
    <p className="font-display text-[clamp(2.25rem,1.2rem+4.2vw,4.5rem)] font-semibold leading-none tracking-[-0.04em]">
      <span className="text-ink-3">s3://</span>
      <span>bucket</span>
      <span className="text-gold-text">/</span>
      <span>key</span>
      <span className="caret-blink ml-1 !h-[0.8em] !w-[0.45em]" aria-hidden />
    </p>
    <figcaption className="max-w-[44ch] text-ink-2">
      One flat namespace. A bucket holds keys, and the slash inside a key is
      only a delimiter the browser agrees to draw as folders.
    </figcaption>
  </figure>
);

export default function LoginPage() {
  const auth = useAuth();
  const [params] = useSearchParams();
  const theme = useStore(appStore, (s) => s.theme);
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });
  const login = useLogin();
  const error = params.get("error");

  const toggle = () => appStore.setTheme(theme === "dark" ? "light" : "dark");
  const themeButton = (
    <IconButton
      label={
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      }
      icon={theme === "dark" ? Sun : Moon}
      onClick={toggle}
    />
  );
  const ssoOnly = auth.oidcEnabled && !auth.localEnabled;
  const ssoClass = cn(
    buttonBase,
    buttonSizes.md.text,
    ssoOnly ? buttonVariants.primary : buttonVariants.secondary,
    "w-full",
  );

  return (
    <div className="grid min-h-dvh md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <Page title="Sign in" />
      <a href="#signin" className="skip-link">
        Skip to sign in
      </a>
      <section
        aria-label="About"
        className="flex flex-col justify-between gap-12 border-b border-rule px-5 py-6 md:border-b-0 md:border-r md:px-10 md:py-10"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src={garageLogo}
              alt=""
              width={26}
              height={26}
              className="rounded-sm bg-[#fff3c4] p-0.5"
            />
            <span className="font-display text-h2 font-semibold tracking-[-0.03em]">
              garage
            </span>
          </div>
          <span className="md:hidden">{themeButton}</span>
        </div>
        <Anatomy />
        <p className="hidden text-ink-3 md:block">Private console</p>
      </section>

      <main
        id="signin"
        tabIndex={-1}
        className="relative flex items-center justify-center px-5 py-10 outline-none md:px-10"
      >
        <div className="absolute right-5 top-5 hidden md:block">
          {themeButton}
        </div>
        <div className="grid w-full max-w-[22rem] gap-5">
          <div>
            <h1 className="font-display text-[2rem] font-semibold leading-none tracking-[-0.03em]">
              Sign in
            </h1>
            <p className="mt-2 text-ink-3">
              {ssoOnly
                ? "Use your organization account to continue."
                : "Enter your administrator credentials to continue."}
            </p>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-sm border border-bad p-3 text-bad [text-wrap:pretty]"
            >
              {error === "access_denied"
                ? "Your account does not belong to an allowed administrator group."
                : "SSO sign-in failed or expired. Please try again."}
            </p>
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
              <span className="h-px flex-1 bg-rule-strong" />
              or
              <span className="h-px flex-1 bg-rule-strong" />
            </div>
          ) : null}

          {auth.oidcEnabled ? (
            <a href={url("/api/auth/oidc/login")} className={ssoClass}>
              Continue with SSO <ArrowRight size={14} aria-hidden />
            </a>
          ) : null}

          {!auth.oidcEnabled && !auth.localEnabled ? (
            <p
              role="alert"
              className="rounded-sm border border-warn p-3 text-warn [text-wrap:pretty]"
            >
              Sign-in is not configured. Contact your administrator.
            </p>
          ) : null}

          <p className="text-caption text-ink-3">
            Access is restricted to authorized administrators.
          </p>
        </div>
      </main>
    </div>
  );
}
