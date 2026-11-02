import { useId, useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { companyProfiles, profileName } from "@/lib/profiles";
import type { Entry } from "@/lib/types";
import { Field, Input } from "./ui/input";

export function CompanyProfileField({
  label,
  value,
  onChange,
  onSelect,
  saveProfile,
  onSaveProfileChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (profile: Entry) => void;
  saveProfile: boolean;
  onSaveProfileChange: (save: boolean) => void;
  required?: boolean;
}) {
  const { workspace } = useWorkspace();
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const id = useId();
  const profiles = companyProfiles(workspace.entries, workspace.company!.id);
  const query = profileName(value);
  const matches = query
    ? profiles.filter((p) => profileName(p.title).includes(query)).slice(0, 8)
    : [];
  const exact = profiles.some((p) => profileName(p.title) === query);
  const open = focused && matches.length > 0;
  const select = (profile: Entry) => {
    onSelect(profile);
    setFocused(false);
    setActive(-1);
    onSaveProfileChange(false);
  };
  return (
    <Field label={label}>
      <div className="profile-picker">
        <Input
          required={required}
          maxLength={240}
          placeholder="Company name"
          value={value}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          aria-activedescendant={
            open && active >= 0 ? `${id}-${active}` : undefined
          }
          autoComplete="off"
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setActive(-1);
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setFocused(true);
            setActive(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              if (!matches.length) return;
              e.preventDefault();
              setFocused(true);
              setActive((current) =>
                e.key === "ArrowDown"
                  ? (current + 1) % matches.length
                  : (current <= 0 ? matches.length : current) - 1,
              );
            } else if (e.key === "Enter" && open && active >= 0) {
              e.preventDefault();
              select(matches[active]);
            } else if (e.key === "Escape" && open) {
              e.preventDefault();
              e.stopPropagation();
              setFocused(false);
            }
          }}
        />
        {open && (
          <div
            className="profile-suggestions"
            role="listbox"
            id={id}
            aria-label="Company profiles"
          >
            {matches.map((profile, index) => (
              <div
                key={profile.id}
                id={`${id}-${index}`}
                role="option"
                aria-selected={index === active}
                className={index === active ? "active" : ""}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(profile)}
              >
                <strong>{profile.title}</strong>
                <span>{profile.category}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {query && !exact && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={saveProfile}
            onChange={(e) => onSaveProfileChange(e.target.checked)}
          />
          Save {value.trim()} as a company profile
        </label>
      )}
    </Field>
  );
}
