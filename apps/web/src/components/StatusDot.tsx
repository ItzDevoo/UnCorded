export type UserStatus = "online" | "idle" | "dnd" | "offline";

interface StatusDotProps {
  status: UserStatus;
  size?: "sm" | "md";
  borderClass?: string;
}

const sizeMap = {
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
} as const;

function statusColor(status: UserStatus): string {
  switch (status) {
    case "online":
      return "bg-success";
    case "idle":
      return "bg-warning";
    case "dnd":
      return "bg-destructive";
    default:
      return "bg-muted-foreground/50";
  }
}

function statusLabel(status: UserStatus): string {
  switch (status) {
    case "online":
      return "Online";
    case "idle":
      return "Idle";
    case "dnd":
      return "Do Not Disturb";
    default:
      return "Offline";
  }
}

const StatusDot = (props: StatusDotProps) => {
  const size = () => sizeMap[props.size ?? "md"];
  const border = () => props.borderClass ?? "border-card";

  return (
    <div
      role="status"
      class={`absolute -bottom-0.5 -right-0.5 rounded-full border-2 ${border()} ${size()} ${statusColor(props.status)}`}
      title={statusLabel(props.status)}
      aria-label={statusLabel(props.status)}
    />
  );
};

/** Inline variant — not absolutely positioned, for use outside avatar containers. */
export const StatusDotInline = (props: { status: UserStatus }) => (
  <div
    role="status"
    class={`h-2 w-2 shrink-0 rounded-full ${statusColor(props.status)}`}
    title={statusLabel(props.status)}
    aria-label={statusLabel(props.status)}
  />
);

export default StatusDot;
