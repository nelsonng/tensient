interface StatusPillProps {
  status: "active" | "pending" | "error" | "success";
  label: string;
}

const statusStyles = {
  active: "bg-primary/20 text-primary border-primary/50",
  pending: "bg-gray-500/20 text-gray-400 border-gray-500/50",
  error: "bg-destructive/20 text-destructive border-destructive/50",
  success: "bg-success/20 text-success border-success/50",
};

export function StatusPill({ status, label }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs uppercase tracking-widest ${statusStyles[status]}`}
    >
      {label}
    </span>
  );
}
