interface PanelCardProps {
  children: React.ReactNode;
  className?: string;
}

export function PanelCard({ children, className = "" }: PanelCardProps) {
  return (
    <div
      className={`rounded-lg border border-border bg-panel p-6 ${className}`}
    >
      {children}
    </div>
  );
}
