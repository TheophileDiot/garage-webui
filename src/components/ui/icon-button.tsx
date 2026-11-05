import { LucideIcon } from "lucide-react";
import { ButtonHTMLAttributes, forwardRef } from "react";
import { Link } from "react-router-dom";
import { ButtonSize, buttonClass, ButtonVariant } from "./button-styles";

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

/** Square icon-only control, 30 x 30 on desktop at the smallest. Hover takes a background fill and a border, never colour alone. */
const IconButton = forwardRef<HTMLButtonElement, Props>(
  (
    {
      label,
      icon: Icon,
      variant = "ghost",
      size = "md",
      href,
      iconSize = 16,
      type = "button",
      className,
      ...rest
    },
    ref,
  ) => {
    const classes = buttonClass({ variant, size, iconOnly: true, className });
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
