import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import React, { forwardRef, ReactNode, useId } from "react";
import FormControl from "./form-control";
import { FieldValues } from "react-hook-form";

/**
 * Fields are 34 px tall on desktop and 36 px on touch, on the surface colour with a strong rule. Text is 16 px
 * below `md`: iOS Safari zooms the page on focus into any field under 16 px.
 */
export const inputClass =
  "h-9 w-full min-w-0 rounded border border-line-strong bg-surface px-2.5 text-[16px] text-ink transition-colors duration-100 desk:text-body " +
  "placeholder:text-ink-3 hover:border-ink-3 focus-visible:border-focus focus-visible:[outline-offset:0] " +
  "aria-[invalid=true]:border-bad read-only:bg-surface-2 read-only:text-ink-2 disabled:opacity-50 desk:h-[34px]";

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
            "flex h-9 items-center rounded border bg-surface transition-colors duration-100 focus-within:border-focus desk:h-[34px]",
            error ? "border-bad" : "border-line-strong hover:border-ink-3",
          )}
        >
          {prefix ? (
            <span className="select-none pl-2.5 font-mono text-[12.5px] text-ink-3">
              {prefix}
            </span>
          ) : null}
          <input
            ref={ref}
            id={fid}
            aria-describedby={hint || error ? hid : undefined}
            aria-invalid={error ? true : undefined}
            className={cn(
              "h-full min-w-0 flex-1 rounded bg-transparent px-2.5 text-[16px] text-ink placeholder:text-ink-3 focus-visible:[outline-offset:-1px] desk:text-body",
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

/**
 * A search box: the field with a leading magnifier. Give `label` an accessible name; it is visually hidden.
 * Same size as every other field, so it lines up with a button beside it.
 */
export const SearchField = forwardRef<
  HTMLInputElement,
  Omit<InputProps, "type"> & { label: string }
>(({ label, className, ...rest }, ref) => {
  const uid = useId();
  return (
    <div
      className={cn(
        "relative min-w-[200px] flex-1 sm:max-w-[340px]",
        className,
      )}
    >
      <label htmlFor={rest.id ?? uid} className="sr-only">
        {label}
      </label>
      <Search
        size={16}
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3"
      />
      <input
        ref={ref}
        id={rest.id ?? uid}
        type="search"
        autoComplete="off"
        className={cn(inputClass, "pl-[33px]")}
        {...rest}
      />
    </div>
  );
});
SearchField.displayName = "SearchField";

export default Input;
