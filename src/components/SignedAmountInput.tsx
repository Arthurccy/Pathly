import type { InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onValueChange: (value: string) => void;
};

export default function SignedAmountInput({ value, onValueChange, className, ...props }: Props) {
  return <div className="flex items-center gap-2">
    <input {...props} className={`${className || ''} min-w-0 flex-1`} type="text" inputMode="decimal" pattern="(-|[+])?[0-9]+([.,][0-9]{1,2})?"
      value={value} onChange={event => onValueChange(event.target.value)} />
    <button type="button" disabled={props.disabled} aria-label="Inverser le signe du solde"
      title="Solde négatif ou positif" onClick={() => onValueChange(value.startsWith('-') ? value.slice(1) : `-${value.replace(/^\+/, '')}`)}
      className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-slate-700 dark:text-slate-200">±</button>
  </div>;
}
