import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface InlineEditCellProps {
  value: string;
  displayValue?: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onConfirm: (newValue: string) => void;
  onCancel: () => void;
}

export function InlineEditCell({ value, displayValue, isEditing, onStartEdit, onConfirm, onCancel }: InlineEditCellProps) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setDraft(value);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isEditing, value]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onConfirm(draft);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        className="txn-inline-edit"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => onConfirm(draft)}
      />
    );
  }

  return (
    <span className="txn-inline-editable" onClick={onStartEdit} title={value}>
      {displayValue || value}
    </span>
  );
}
