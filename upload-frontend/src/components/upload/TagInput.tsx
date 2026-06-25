import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface TagInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  id?: string;
}

/** Chip/tag input: type a value and press Enter (or comma) to add it; backspace removes the last. */
const TagInput = ({ values, onChange, placeholder, id }: TagInputProps) => {
  const [draft, setDraft] = useState('');

  const addValue = (raw: string) => {
    const v = raw.trim();
    if (!v || values.includes(v)) {
      setDraft('');
      return;
    }
    onChange([...values, v]);
    setDraft('');
  };

  const removeAt = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addValue(draft);
    } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      removeAt(values.length - 1);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-wrap gap-2 rounded-md border border-input bg-background px-3 py-2 min-h-10',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background',
      )}
    >
      {values.map((value, i) => (
        <span
          key={value}
          className="inline-flex items-center gap-1 rounded bg-primary/10 text-primary text-xs font-medium px-2 py-1"
        >
          <span className="font-mono">{value}</span>
          <button
            type="button"
            onClick={() => removeAt(i)}
            className="hover:text-destructive"
            aria-label={`Remove ${value}`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addValue(draft)}
        placeholder={values.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[8rem] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
};

export default TagInput;
