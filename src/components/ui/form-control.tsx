import { cn } from "@/lib/utils";
import { ComponentPropsWithoutRef, useId } from "react";
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

const FormControl = <
  T extends FieldValues,
  U extends FieldPath<T> = FieldPath<T>,
>({
  form,
  name,
  title,
  className,
  render,
}: FormControlProps<T, U>) => {
  const uid = useId();
  const id = `${uid}-${name}`;
  const errorId = `${id}-error`;

  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState, formState }) => (
        <div className={cn("form-control", className)}>
          {title ? (
            <label htmlFor={id} className="label label-text">
              {title}
            </label>
          ) : null}

          {render(field, {
            fieldState,
            formState,
            id,
            describedBy: fieldState.error ? errorId : undefined,
          })}

          {fieldState.error ? (
            <p
              id={errorId}
              role="alert"
              className="label label-text text-error"
            >
              {fieldState.error.message}
            </p>
          ) : null}
        </div>
      )}
    />
  );
};

export default FormControl;
