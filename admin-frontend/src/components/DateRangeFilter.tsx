import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar, ChevronDown } from 'lucide-react';
import {
  currentMonthRange,
  lastNDaysRange,
  formatRangeLabel,
  type DateRange,
} from '../utils/dateRange';

type Preset = 'month' | '7d' | '30d' | 'custom';

const presets: { key: Exclude<Preset, 'custom'>; label: string }[] = [
  { key: 'month', label: 'This Month' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
];

interface DateRangeFilterProps {
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
}

/** Compact top-right popover for selecting a date range (presets + custom From/To). */
const DateRangeFilter = ({ range, onRangeChange }: DateRangeFilterProps) => {
  const [activePreset, setActivePreset] = useState<Preset>('month');
  const rangeInvalid = !range.start || !range.end || range.start > range.end;

  const applyPreset = (preset: Exclude<Preset, 'custom'>) => {
    setActivePreset(preset);
    if (preset === 'month') onRangeChange(currentMonthRange());
    else if (preset === '7d') onRangeChange(lastNDaysRange(7));
    else onRangeChange(lastNDaysRange(30));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 font-normal">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="tabular-nums">{formatRangeLabel(range)}</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto min-w-[20rem] p-0">
        <div className="px-4 py-3 border-b">
          <p className="text-sm font-medium text-foreground">Filter by period</p>
          <p className="text-xs text-muted-foreground mt-0.5">Choose a preset or a custom date range.</p>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {presets.map((p) => (
              <Button
                key={p.key}
                size="sm"
                variant={activePreset === p.key ? 'default' : 'outline'}
                onClick={() => applyPreset(p.key)}
                className="text-xs px-2"
              >
                {p.label}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="from-date" className="text-xs font-medium text-muted-foreground">From</label>
              <Input
                id="from-date"
                type="date"
                value={range.start}
                max={range.end || undefined}
                onChange={(e) => {
                  setActivePreset('custom');
                  onRangeChange({ ...range, start: e.target.value });
                }}
                className="h-9"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="to-date" className="text-xs font-medium text-muted-foreground">To</label>
              <Input
                id="to-date"
                type="date"
                value={range.end}
                min={range.start || undefined}
                onChange={(e) => {
                  setActivePreset('custom');
                  onRangeChange({ ...range, end: e.target.value });
                }}
                className="h-9"
              />
            </div>
          </div>

          {rangeInvalid && (
            <p className="text-xs text-destructive">
              "From" date must be on or before the "To" date.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DateRangeFilter;
