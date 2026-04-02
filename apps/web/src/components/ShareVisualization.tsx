import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import type { ShareSession, ParticipantInfo } from "../stores/share-session-store.js";
import { formatBytes } from "./FileMessage.js";

interface Props {
  session: ShareSession;
}

// ── Line Colors ──────────────────────────────────────────────────────────────

function getLineColor(status: ParticipantInfo["status"]): string {
  switch (status) {
    case "complete":
      return "oklch(0.66 0.17 155)";
    case "downloading":
      return "oklch(0.65 0.16 255)";
    case "error":
      return "oklch(0.55 0.2 25)";
    default:
      return "oklch(0.4 0 0)";
  }
}

function getStatusClass(status: ParticipantInfo["status"]): string {
  switch (status) {
    case "complete":
      return "text-success-foreground";
    case "downloading":
      return "text-info-foreground";
    case "error":
      return "text-destructive-foreground";
    default:
      return "text-muted-foreground";
  }
}

function getStatusLabel(status: ParticipantInfo["status"], progress: number): string {
  switch (status) {
    case "invited":
      return "Waiting...";
    case "joined":
      return "Connected";
    case "downloading":
      return `${Math.round(progress * 100)}%`;
    case "complete":
      return "Complete";
    case "error":
      return "Error";
    default:
      return "";
  }
}

function getBorderClass(status: ParticipantInfo["status"]): string {
  switch (status) {
    case "complete":
      return "ring-2 ring-success/50";
    case "downloading":
      return "ring-2 ring-info/50";
    case "error":
      return "ring-2 ring-destructive/50";
    default:
      return "ring-1 ring-border";
  }
}

const ShareVisualization = (props: Props) => {
  // oxlint-disable-next-line no-unassigned-vars -- SolidJS ref assigned via JSX
  let svgRef!: SVGSVGElement;
  const [dimensions, setDimensions] = createSignal({ width: 500, height: 200 });

  const participants = createMemo((): ParticipantInfo[] => {
    return Object.values(props.session.participants);
  });

  // Measure container for SVG lines
  // oxlint-disable-next-line no-unassigned-vars -- SolidJS ref assigned via JSX
  let containerRef!: HTMLDivElement;

  const updateDimensions = () => {
    if (containerRef) {
      const rect = containerRef.getBoundingClientRect();
      setDimensions({ width: rect.width, height: rect.height });
    }
  };

  onMount(() => {
    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    if (containerRef) observer.observe(containerRef);
    onCleanup(() => observer.disconnect());
  });

  return (
    <div class="flex flex-col gap-4">
      {/* File info header */}
      <div class="text-center">
        <p class="text-sm font-medium text-foreground">{props.session.fileName}</p>
        <p class="text-xs text-muted-foreground">{formatBytes(props.session.fileSize)}</p>
        <Show when={props.session.status === "complete"}>
          <p class="mt-1 text-xs text-success-foreground">All transfers complete</p>
        </Show>
      </div>

      {/* Main layout: sender — lines — recipients */}
      <div ref={containerRef} class="relative flex min-h-[200px] items-center gap-0">

        {/* Sender (left) */}
        <div class="z-10 flex shrink-0 flex-col items-center gap-2" style={{ width: "100px" }}>
          <div class="relative">
            <Show
              when={props.session.senderAvatarUrl}
              fallback={
                <div class="flex h-16 w-16 items-center justify-center rounded-full bg-card ring-2 ring-primary/50 text-xl font-semibold text-foreground">
                  {(props.session.senderDisplayName ?? props.session.senderUsername ?? "?").charAt(0).toUpperCase()}
                </div>
              }
            >
              {(url) => (
                <img
                  src={url()}
                  alt=""
                  class="h-16 w-16 rounded-full object-cover ring-2 ring-primary/50"
                />
              )}
            </Show>
          </div>
          <span class="max-w-[90px] truncate text-xs font-medium text-foreground">
            {props.session.senderDisplayName ?? props.session.senderUsername ?? "You"}
          </span>
        </div>

        {/* SVG lines overlay */}
        <svg
          ref={svgRef}
          class="pointer-events-none absolute inset-0 z-0"
          style={{ width: "100%", height: "100%" }}
        >
          <For each={participants()}>
            {(participant, index) => {
              const total = () => participants().length;
              // Calculate Y positions to match the recipient list layout
              const recipientSpacing = () => {
                const h = dimensions().height;
                const t = total();
                if (t <= 1) return h / 2;
                return h / (t + 1);
              };
              const recipientY = () => recipientSpacing() * (index() + 1);
              const senderY = () => dimensions().height / 2;
              const leftX = 100;
              const rightX = () => dimensions().width - 100;

              const pathD = () => {
                const sx = leftX;
                const sy = senderY();
                const ex = rightX();
                const ey = recipientY();
                const cx1 = sx + (ex - sx) * 0.35;
                const cx2 = sx + (ex - sx) * 0.65;
                return `M ${sx} ${sy} C ${cx1} ${sy}, ${cx2} ${ey}, ${ex} ${ey}`;
              };

              return (
                <>
                  {/* Background line */}
                  <path
                    d={pathD()}
                    fill="none"
                    stroke={getLineColor(participant.status)}
                    stroke-width="1.5"
                    stroke-dasharray={participant.status === "invited" || participant.status === "joined" ? "6 4" : "none"}
                    opacity="0.25"
                  />

                  {/* Progress fill */}
                  <Show when={participant.status === "downloading" && participant.progress > 0}>
                    <path
                      d={pathD()}
                      fill="none"
                      stroke={getLineColor("downloading")}
                      stroke-width="2"
                      stroke-dasharray={`${participant.progress * 100} ${100}`}
                      pathLength={100}
                    />
                  </Show>

                  {/* Complete line */}
                  <Show when={participant.status === "complete"}>
                    <path
                      d={pathD()}
                      fill="none"
                      stroke={getLineColor("complete")}
                      stroke-width="2"
                    />
                  </Show>

                  {/* Particles */}
                  <Show when={participant.status === "downloading"}>
                    <circle r="2.5" fill={getLineColor("downloading")} opacity="0.8">
                      <animateMotion dur="2s" repeatCount="indefinite" path={pathD()} />
                    </circle>
                    <circle r="1.5" fill={getLineColor("downloading")} opacity="0.4">
                      <animateMotion dur="2s" repeatCount="indefinite" path={pathD()} begin="0.7s" />
                    </circle>
                  </Show>
                </>
              );
            }}
          </For>
        </svg>

        {/* Spacer for lines */}
        <div class="min-w-0 flex-1" />

        {/* Recipients (right) */}
        <div class="z-10 flex shrink-0 flex-col items-center gap-3" style={{ width: "100px" }}>
          <Show
            when={participants().length > 0}
            fallback={
              <div class="flex h-full items-center">
                <p class="text-xs text-muted-foreground">Waiting for<br />recipients...</p>
              </div>
            }
          >
            <For each={participants()}>
              {(participant) => (
                <div class="flex flex-col items-center gap-1">
                  <div class="relative">
                    <Show
                      when={participant.avatarUrl}
                      fallback={
                        <div class={`flex h-12 w-12 items-center justify-center rounded-full bg-card text-sm font-semibold text-foreground ${getBorderClass(participant.status)}`}>
                          {(participant.displayName ?? participant.username ?? "?").charAt(0).toUpperCase()}
                        </div>
                      }
                    >
                      {(url) => (
                        <img
                          src={url()}
                          alt=""
                          class={`h-12 w-12 rounded-full object-cover ${getBorderClass(participant.status)}`}
                        />
                      )}
                    </Show>
                  </div>
                  <span class="max-w-[90px] truncate text-[11px] font-medium text-foreground">
                    {participant.displayName ?? participant.username}
                  </span>
                  <span class={`text-[10px] ${getStatusClass(participant.status)}`}>
                    {getStatusLabel(participant.status, participant.progress)}
                  </span>
                  <Show when={participant.status === "downloading" && participant.speed > 0}>
                    <span class="text-[9px] text-muted-foreground">
                      {formatBytes(participant.speed)}/s
                    </span>
                  </Show>
                </div>
              )}
            </For>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default ShareVisualization;
