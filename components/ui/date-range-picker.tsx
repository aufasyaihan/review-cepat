'use client';

import { endOfDay, endOfMonth, endOfYear, format, startOfDay, startOfMonth, startOfYear, subDays, subMonths } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from 'cn';

export type DateRange = { from: Date; to: Date };

type PresetKey =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last14'
  | 'last30'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear';

const PRESETS: Array<{ key: PresetKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7', label: 'Last 7 days' },
  { key: 'last14', label: 'Last 14 days' },
  { key: 'last30', label: 'Last 30 days' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'thisYear', label: 'This year' },
];

function presetRange(key: PresetKey): DateRange {
  const now = new Date();
  switch (key) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday':
      return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) };
    case 'last7':
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case 'last14':
      return { from: startOfDay(subDays(now, 13)), to: endOfDay(now) };
    case 'last30':
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case 'thisMonth':
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'lastMonth':
      return { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) };
    case 'thisYear':
      return { from: startOfYear(now), to: endOfYear(now) };
  }
}

const fmt = (date: Date) => format(date, 'MMM d, yyyy');

/**
 * Compact date-range picker with common presets and a 2-month range calendar.
 * Hardcoded English labels (no i18n in this project).
 */
export function DateRangePicker({
  range,
  onApply,
  className,
}: {
  range: DateRange | null;
  onApply: (range: DateRange) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | null>(range);

  const selected = useMemo(
    () => (draft ? { from: draft.from, to: draft.to } : undefined),
    [draft],
  );

  const handlePreset = useCallback((key: PresetKey) => {
    setDraft(presetRange(key));
  }, []);

  const handleSelect = useCallback((picked: { from?: Date; to?: Date } | undefined) => {
    if (!picked?.from || !picked.to) return;
    setDraft({ from: picked.from, to: picked.to });
  }, []);

  const handleApply = useCallback(() => {
    if (!draft) return;
    onApply(draft);
    setOpen(false);
  }, [draft, onApply]);

  const handleReset = useCallback(() => {
    setDraft(range);
  }, [range]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" className={cn('justify-start gap-2', className)}>
            <CalendarIcon />
            {range ? (
              <span>
                {fmt(range.from)} – {fmt(range.to)}
              </span>
            ) : (
              <span className="text-muted-foreground">Pick a date range</span>
            )}
          </Button>
        }
      />
      <PopoverContent align="start" side="bottom" className="w-auto p-0">
        <div className="flex">
          <div className="flex flex-col p-3">
            {PRESETS.map((preset) => (
              <Button
                key={preset.key}
                type="button"
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => handlePreset(preset.key)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <Separator orientation="vertical" />
          <Calendar mode="range" selected={selected} onSelect={handleSelect} numberOfMonths={2} />
        </div>
        <Separator />
        <div className="flex items-center justify-end gap-2 p-3">
          <Button type="button" variant="outline" size="sm" onClick={handleReset}>
            Reset
          </Button>
          <Button type="button" size="sm" onClick={handleApply} disabled={!draft}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}