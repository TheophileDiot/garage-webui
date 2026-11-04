import { cn } from "@/lib/utils";
import React, { forwardRef, ReactNode, useId } from "react";
import FormControl from "./form-control";
import { FieldValues } from "react-hook-form";

/** Inputs are inset (the `sunk` surface) so they read as "type here" without a heavy border. */
export const inputClass =
  "h-9 w-full min-w-0 rounded-sm border border-rule-strong bg-sunk px-2.5 text-ink transition-colors duration-caret " +
  "placeholder:text-ink-3 hover:border-ink-3 focus-visible:border-gold-text focus-visible:[outline-offset:-1px] " +
  "aria-[invalid=true]:border-bad read-only:text-ink-2 disabled:opacity-40 md:h-8";

type InputProps = Omit<React.ComponentPropsWithoutRef<"input">, "form">;

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return <input ref={ref} className={cn(inputClass, className)} {...props} />;
  },
);
Input.displayName = "Input";

type TextFieldProps = Omit<InputProps, "prefix"> & {
  label: string;
  hint?: ReactNode;
  error?: string;
  /** Text shown inside the field, before the value (for example `s3://`). */
  prefix?: ReactNode;
};

/** A labelled field outside react-hook-form (search boxes, read-only values). */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, hint, error, prefix, className, id, ...rest }, ref) => {
    const auto = useId();
    const fid = id ?? auto;
    const hid = `${fid}-hint`;
    return (
      <div className="grid gap-1">
        <label htmlFor={fid} className="text-caption font-medium text-ink-2">
          {label}
        </label>
        <div
          className={cn(
            "flex h-9 items-center rounded-sm border bg-sunk transition-colors duration-caret focus-within:border-gold-text md:h-8",
            error ? "border-bad" : "border-rule-strong hover:border-ink-3",
          )}
        >
          {prefix ? (
            <span className="select-none pl-2.5 text-ink-3">{prefix}</span>
          ) : null}
          <input
            ref={ref}
            id={fid}
            aria-describedby={hint || error ? hid : undefined}
            aria-invalid={error ? true : undefined}
            className={cn(
              "h-full min-w-0 flex-1 bg-transparent px-2.5 text-ink placeholder:text-ink-3 focus-visible:[outline-offset:-1px]",
              prefix && "pl-1",
              className,
            )}
            {...rest}
          />
        </div>
        {error ? (
          <p id={hid} role="alert" className="text-caption text-bad">
            {error}
          </p>
        ) : hint ? (
          <p id={hid} className="text-caption text-ink-3">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
TextField.displayName = "TextField";

type InputFieldProps<T extends FieldValues> = Omit<
  React.ComponentPropsWithoutRef<typeof FormControl<T>>,
  "render"
> &
  InputProps & {
    inputClassName?: string;
  };

export const InputField = <T extends FieldValues>({
  form,
  name,
  title,
  hint,
  className,
  inputClassName,
  ...props
}: InputFieldProps<T>) => {
  return (
    <FormControl
      form={form}
      name={name}
      title={title}
      hint={hint}
      className={className}
      render={(field, { id, describedBy, fieldState }) => (
        <Input
          {...props}
          {...field}
          value={field.value ?? ""}
          onChange={(e) =>
            field.onChange(
              props.type === "number"
                ? e.target.value === ""
                  ? null
                  : e.target.valueAsNumber
                : e,
            )
          }
          id={props.id || id}
          aria-invalid={fieldState.error ? true : undefined}
          aria-describedby={describedBy}
          className={inputClassName}
        />
      )}
    />
  );
};

export default Input;
