import { cn } from "@/lib/utils";
import React, { forwardRef, ReactNode } from "react";
import FormControl from "./form-control";
import { FieldValues } from "react-hook-form";

type ToggleProps = Omit<React.ComponentPropsWithoutRef<"input">, "form"> & {
  label?: string;
  description?: ReactNode;
};

/**
 * A switch with its state written out: the box reads "On" or "Off", never colour alone.
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
            "inline-flex h-9 min-w-[3.75rem] shrink-0 items-center justify-center rounded border border-line-strong bg-surface px-2.5 font-medium text-ink-2 transition-colors duration-100 md:h-[34px]",
            "hover:border-ink-3 hover:bg-surface-2",
            "after:content-['Off'] peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-ink peer-checked:after:content-['On'] peer-checked:hover:border-primary-hover peer-checked:hover:bg-primary-hover",
            "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
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
