interface MonoLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function MonoLabel({ children, className = "" }: MonoLabelProps) {
  return (
    <span
      className={`font-mono text-sm uppercase tracking-widest text-muted ${className}`}
    >
      {children}
    </span>
  );
}
