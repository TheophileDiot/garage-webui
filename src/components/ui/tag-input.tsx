import { cn } from "@/lib/utils";
import { KeyboardEvent, useId, useState } from "react";
import Chips from "./chips";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  /** Existing tags offered as one-click additions. */
  suggestions: string[];
  label: string;
  id?: string;
  className?: string;
  disabled?: boolean;
};

/**
 * Chip input for free-form tags: Enter or comma adds, Backspace on an empty field removes the last, and text left
 * in the field is added on blur so nothing typed is lost. Suggestions are plain buttons below the field.
 */
const TagInput = ({
  value,
  onChange,
  suggestions,
  label,
  id,
  className,
  disabled,
}: Props) => {
  const uid = useId();
  const fid = id ?? `${uid}-tags`;
  const hint = `${fid}-hint`;
  const [text, setText] = useState("");

  const add = (raw: string) => {
    const tag = raw.trim();
    setText("");
    if (!tag || value.includes(tag)) return;
    onChange([...value, tag]);
  };
  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(text);
    } else if (e.key === "Backspace" && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const needle = text.trim().toLowerCase();
  const offered = suggestions
    .filter((s) => !value.includes(s) && s.toLowerCase().includes(needle))
    .slice(0, 8);

  return (
    <div className={cn("grid gap-1", className)}>
      <label htmlFor={fid} className="text-caption font-medium text-ink-2">
        {label}
      </label>
      <div className="flex min-h-9 flex-wrap items-center gap-1 rounded border border-line-strong bg-surface p-1 transition-colors duration-100 focus-within:border-focus hover:border-ink-3 md:min-h-[34px]">
        {value.map((tag) => (
          <Chips
            key={tag}
            onRemove={disabled ? undefined : () => remove(tag)}
            removeLabel={`Remove tag ${tag}`}
          >
            {tag}
          </Chips>
        ))}
        <input
          id={fid}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(text)}
          aria-describedby={hint}
          autoComplete="off"
          spellCheck={false}
          className="h-7 min-w-24 flex-1 bg-transparent px-1.5 text-ink placeholder:text-ink-3 focus-visible:[outline-offset:1px]"
        />
      </div>
      <p id={hint} className="text-caption text-ink-3">
        Press Enter or comma to add a tag.
      </p>
      {offered.length ? (
        <ul aria-label="Suggested tags" className="flex flex-wrap gap-1">
          {offered.map((s) => (
            <li key={s}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => add(s)}
                className="inline-flex h-8 items-center rounded border border-line px-2 text-caption text-ink-2 transition-colors duration-100 hover:bg-surface-2 hover:text-ink md:h-[26px]"
              >
                + {s}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export default TagInput;
