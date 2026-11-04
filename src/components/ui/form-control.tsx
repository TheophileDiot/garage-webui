import { cn } from "@/lib/utils";
import { ComponentPropsWithoutRef, ReactNode, useId } from "react";
import {
  FieldValues,
  UseFormReturn,
  Controller,
  ControllerRenderProps,
  ControllerFieldState,
  FieldPath,
  UseFormStateReturn,
} from "react-hook-form";

type FormControlProps<
  T extends FieldValues,
  U extends FieldPath<T> = FieldPath<T>,
> = ComponentPropsWithoutRef<"div"> & {
  form: UseFormReturn<T>;
  name: U;
  title?: string;
  /** Helper text under the field. Replaced by the error while there is one. */
  hint?: ReactNode;

  render: (
    field: ControllerRenderProps<T, U>,
    fieldProps: {
      fieldState: ControllerFieldState;
      formState: UseFormStateReturn<T>;
      id: string;
      describedBy?: string;
    },
  ) => React.ReactElement;
};

/** Label, control, hint and error as one unit, wired to react-hook-form. The error is announced and described by id. */
const FormControl = <
  T extends FieldValues,
  U extends FieldPath<T> = FieldPath<T>,
>({
  form,
  name,
  title,
  hint,
  className,
  render,
}: FormControlProps<T, U>) => {
  const uid = useId();
  const id = `${uid}-${name}`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState, formState }) => (
        <div className={cn("grid gap-1", className)}>
          {title ? (
            <label htmlFor={id} className="text-caption font-medium text-ink-2">
              {title}
            </label>
          ) : null}

          {render(field, {
            fieldState,
            formState,
            id,
            describedBy: fieldState.error ? errorId : hint ? hintId : undefined,
          })}

          {fieldState.error ? (
            <p id={errorId} role="alert" className="text-caption text-bad">
              {fieldState.error.message}
            </p>
          ) : hint ? (
            <p id={hintId} className="text-caption text-ink-3">
              {hint}
            </p>
          ) : null}
        </div>
      )}
    />
  );
};

export default FormControl;
