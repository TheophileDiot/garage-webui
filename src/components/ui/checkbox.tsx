import { cn } from "@/lib/utils";
import React, { forwardRef } from "react";
import FormControl from "./form-control";
import { FieldValues } from "react-hook-form";

type CheckboxProps = Omit<React.ComponentPropsWithoutRef<"input">, "form"> & {
  label?: string;
  inputClassName?: string;
};

/** The whole label is the target (at least 24 px tall); the box shows a check mark, not only a colour. */
const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className, inputClassName, ...props }, ref) => {
    return (
      <label
        className={cn(
          "inline-flex min-h-6 cursor-pointer items-center justify-start gap-2 text-ink",
          props.disabled && "cursor-not-allowed opacity-40",
          className,
        )}
      >
        <input
          ref={ref}
          type="checkbox"
          className={cn("cbx", inputClassName)}
          {...props}
        />
        {label}
      </label>
    );
  },
);
Checkbox.displayName = "Checkbox";

type CheckboxFieldProps<T extends FieldValues> = Omit<
  React.ComponentPropsWithoutRef<typeof FormControl<T>>,
  "render"
> &
  CheckboxProps;

export const CheckboxField = <T extends FieldValues>({
  form,
  name,
  ...props
}: CheckboxFieldProps<T>) => {
  return (
    <FormControl
      form={form}
      name={name}
      render={(field) => (
        <Checkbox
          {...props}
          {...field}
          checked={field.value}
          onChange={(e) => field.onChange(e.target.checked)}
        />
      )}
    />
  );
};

export default Checkbox;
