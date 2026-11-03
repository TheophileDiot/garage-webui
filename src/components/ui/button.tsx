import { LucideIcon } from "lucide-react";
import { ComponentPropsWithoutRef, forwardRef } from "react";
import { Button as BaseButton } from "react-daisyui";
import { Link } from "react-router-dom";

type ButtonProps = ComponentPropsWithoutRef<typeof BaseButton> & {
  type?: HTMLButtonElement["type"];
  form?: string;
  href?: string;
  target?: "_blank" | "_self" | "_parent" | "_top";
  icon?: LucideIcon;
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ href, children, icon: Icon, shape, type = "button", ...props }, ref) => {
    return (
      <BaseButton
        ref={ref}
        tag={href ? Link : undefined}
        shape={Icon && !children ? "square" : shape}
        {...(href ? { to: href } : { type })}
        {...props}
      >
        {Icon ? (
          <Icon size={18} aria-hidden className={children ? "-ml-1" : ""} />
        ) : null}
        {children}
      </BaseButton>
    );
  },
);

export default Button;
