"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function MultiSelectFilter({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" className="min-w-36 justify-between" />}
      >
        <span className="truncate">{values.length ? `${label} (${values.length})` : label}</span>
        <ChevronDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-80 min-w-64" align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          {options.length ? (
            options.map((option) => (
              <DropdownMenuCheckboxItem
                key={option}
                checked={values.includes(option)}
                onCheckedChange={(checked) =>
                  onChange(
                    checked ? [...values, option] : values.filter((value) => value !== option)
                  )
                }
              >
                {values.includes(option) ? <CheckIcon /> : null}
                <span className="max-w-72 whitespace-normal">{option}</span>
              </DropdownMenuCheckboxItem>
            ))
          ) : (
            <DropdownMenuLabel>ไม่มีตัวเลือก</DropdownMenuLabel>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
