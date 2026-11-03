import { cn } from "@/lib/utils";
import { ComponentPropsWithoutRef, forwardRef } from "react";
import BaseSelect, { GroupBase, SelectInstance } from "react-select";
import Creatable from "react-select/creatable";

export type SelectOption = { label: string; value: string };

type Props = ComponentPropsWithoutRef<
  typeof BaseSelect<SelectOption, boolean, GroupBase<SelectOption>>
> & {
  creatable?: boolean;
};

const Select = forwardRef<SelectInstance<SelectOption, boolean>, Props>(
  ({ creatable, ...props }, ref) => {
    const Comp = creatable ? Creatable : BaseSelect;

    return (
      <Comp<SelectOption, boolean>
        ref={ref}
        unstyled
        classNames={{
          control: (p) =>
            cn(
              "bg-base-200 px-3 rounded-btn border text-base-content min-h-12",
              p.isFocused
                ? "border-primary outline outline-2 outline-primary"
                : "border-base-300",
              p.isMulti && "py-1 flex flex-row gap-2 items-center flex-wrap",
            ),
          input: () => "text-base-content",
          placeholder: () => "text-base-content/70",
          menu: () => "mt-1",
          menuList: () =>
            "bg-base-100 rounded-btn border border-base-300 p-1 shadow-lg",
          noOptionsMessage: () => "my-4 text-base-content/70",
          option: (p) =>
            cn(
              "text-base-content px-3 py-2.5 rounded !cursor-pointer",
              p.isFocused ? "bg-base-content/10" : null,
              p.isSelected ? "font-bold text-primary" : null,
            ),
          singleValue: () => "text-base-content",
          multiValue: () =>
            "bg-base-300 text-base-content rounded pl-2 my-0.5 mr-1 flex flex-row items-center",
          multiValueRemove: () =>
            "px-2 py-1 rounded-r hover:bg-error/20 hover:text-error",
          dropdownIndicator: () => "text-base-content/70 px-1",
          clearIndicator: () => "text-base-content/70 px-1",
        }}
        noOptionsMessage={() =>
          creatable ? "Type to add a value" : "No options"
        }
        {...props}
      />
    );
  },
);

export default Select;
