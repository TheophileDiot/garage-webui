import { cn } from "@/lib/utils";
import React, { forwardRef, ReactNode } from "react";
import FormControl from "./form-control";
import { FieldValues } from "react-hook-form";

type ToggleProps = Omit<React.ComponentPropsWithoutRef<"input">, "form"> & {
  label?: string;
  description?: ReactNode;
};

/**
 * A switch with its state written out: the box reads "on" or "off", never colour alone.
 * A real checkbox input with role="switch", so keyboard, forms and assistive tech work as usual.
 */
const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  ({ label, description, className, ...props }, ref) => {
    return (
      <label
        className={cn(
          "flex cursor-pointer items-start justify-between gap-4",
          props.disabled && "cursor-not-allowed opacity-40",
          className,
        )}
      >
        {label || description ? (
          <span className="min-w-0">
            {label ? <span className="block font-medium">{label}</span> : null}
            {description ? (
              <span className="block text-ink-3">{description}</span>
            ) : null}
          </span>
        ) : null}
        <input
          ref={ref}
          type="checkbox"
          role="switch"
          className="peer sr-only"
          {...props}
        />
        <span
          aria-hidden
          className={cn(
            "relative isolate inline-flex h-9 min-w-[3.75rem] shrink-0 items-center gap-2 overflow-hidden rounded-sm border border-rule-strong px-2.5 font-medium text-ink-2 transition-colors duration-caret md:h-7",
            "before:absolute before:inset-0 before:-z-10 before:origin-left before:scale-x-0 before:bg-gold before:transition-transform before:duration-caret before:ease-caret hover:border-gold hover:text-gold-ink hover:before:scale-x-100",
            "after:content-['off'] peer-checked:border-gold peer-checked:bg-gold peer-checked:text-gold-ink peer-checked:after:content-['on'] peer-checked:before:bg-ink peer-checked:hover:text-ground",
            "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-text",
          )}
        />
      </label>
    );
  },
);
Toggle.displayName = "Toggle";

type ToggleFieldProps<T extends FieldValues> = Omit<
  React.ComponentPropsWithoutRef<typeof FormControl<T>>,
  "render"
> &
  ToggleProps & {
    inputClassName?: string;
  };

export const ToggleField = <T extends FieldValues>({
  form,
  name,
  title,
  className,
  inputClassName,
  ...props
}: ToggleFieldProps<T>) => {
  return (
    <FormControl
      form={form}
      name={name}
      title={title}
      className={className}
      render={(field, { id }) => (
        <Toggle
          {...props}
          {...field}
          id={props.id || id}
          className={inputClassName}
          checked={field.value || false}
          onChange={(e) => field.onChange(e.target.checked)}
        />
      )}
    />
  );
};

export default Toggle;
