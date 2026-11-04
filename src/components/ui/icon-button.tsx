import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { ButtonHTMLAttributes, forwardRef } from "react";
import { Link } from "react-router-dom";
import {
  ButtonSize,
  buttonBase,
  ButtonVariant,
  buttonSizes,
  buttonVariants,
} from "./button-styles";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  /** The accessible name and the tooltip. Required: the control has no visible text. */
  label: string;
  icon: LucideIcon;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Router path: renders a link with the same look. */
  href?: string;
  iconSize?: number;
};

/** Square icon-only control, 24 x 24 at the smallest. Hover takes a background fill, never colour alone. */
const IconButton = forwardRef<HTMLButtonElement, Props>(
  (
    {
      label,
      icon: Icon,
      variant = "ghost",
      size = "md",
      href,
      iconSize = 15,
      type = "button",
      className,
      ...rest
    },
    ref,
  ) => {
    const classes = cn(
      buttonBase,
      buttonSizes[size].icon,
      buttonVariants[variant],
      className,
    );
    const icon = <Icon size={iconSize} aria-hidden />;
    if (href) {
      return (
        <Link to={href} aria-label={label} title={label} className={classes}>
          {icon}
        </Link>
      );
    }
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={classes}
        {...rest}
      >
        {icon}
      </button>
    );
  },
);
IconButton.displayName = "IconButton";

export default IconButton;
