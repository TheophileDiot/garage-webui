import { Loader2, LucideIcon } from "lucide-react";
import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ButtonSize, buttonClass, ButtonVariant } from "./button-styles";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A lucide icon. With no children the button becomes a square icon button. */
  icon?: LucideIcon;
  /** Router path: renders a link that looks like the button. */
  href?: string;
  target?: "_blank" | "_self" | "_parent" | "_top";
  form?: string;
  /** Pending: shows a spinner, disables the control and sets aria-busy. */
  loading?: boolean;
  className?: string;
  children?: ReactNode;
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant,
      size,
      icon: Icon,
      href,
      target,
      loading,
      type = "button",
      className,
      children,
      disabled,
      onClick,
      ...props
    },
    ref,
  ) => {
    const iconOnly = Boolean(Icon) && !children;
    const classes = buttonClass({ variant, size, iconOnly, className });
    const inner = (
      <>
        {loading ? (
          <Loader2 size={16} aria-hidden className="animate-spin" />
        ) : Icon ? (
          <Icon size={16} aria-hidden />
        ) : null}
        {children}
      </>
    );

    if (href) {
      const off = Boolean(disabled || loading);
      return (
        <Link
          to={href}
          target={target}
          rel={target === "_blank" ? "noopener noreferrer" : undefined}
          className={classes}
          aria-disabled={off || undefined}
          aria-busy={loading || undefined}
          tabIndex={off ? -1 : undefined}
          onClick={(e) => {
            if (off) e.preventDefault();
            else
              (onClick as unknown as ((e: unknown) => void) | undefined)?.(e);
          }}
          {...(props as object)}
        >
          {inner}
        </Link>
      );
    }

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        onClick={onClick}
        {...props}
      >
        {inner}
      </button>
    );
  },
);
Button.displayName = "Button";

/** A link that looks like a button. Same as `<Button href=…>`. */
export const LinkButton = forwardRef<
  HTMLButtonElement,
  ButtonProps & { href: string }
>((props, ref) => <Button ref={ref} {...props} />);
LinkButton.displayName = "LinkButton";

export default Button;
