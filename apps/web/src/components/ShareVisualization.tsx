import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import type { ShareSession, ParticipantInfo } from "../stores/share-session-store.js";
import { formatBytes } from "./FileMessage.js";

interface Props {
  session: ShareSession;
}

// ── Physics Constants ────────────────────────────────────────────────────────

const INFLUENCE_RADIUS = 100;
const REPULSION_STRENGTH = 3000;
const SPRING_STIFFNESS = 0.08;
const DAMPING = 0.85;

interface PhysicsBody {
  restX: number;
  restY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

// ── SVG Layout Constants ─────────────────────────────────────────────────────

const SENDER_X = 80;
const RECIPIENT_X = 520;
const AVATAR_SIZE_SENDER = 80;
const AVATAR_SIZE_RECIPIENT = 56;

function getRecipientY(index: number, total: number): number {
  if (total === 0) return 200;
  const spacing = Math.min(80, 400 / Math.max(total, 1));
  const startY = 200 - ((total - 1) * spacing) / 2;
  return startY + index * spacing;
}

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

function getLineStrokeDash(status: ParticipantInfo["status"]): string {
  if (status === "invited" || status === "joined") return "6 4";
  return "none";
}

const ShareVisualization = (props: Props) => {
  const [mousePos, setMousePos] = createSignal({ x: -999, y: -999 });
  let containerRef!: HTMLDivElement;
  let svgRef!: SVGSVGElement;
  let animFrame: number | undefined;
  let bodies: PhysicsBody[] = [];
  let senderBody: PhysicsBody = { restX: 0, restY: 0, x: 0, y: 0, vx: 0, vy: 0 };

  const participants = createMemo(() => {
    const p = props.session.participants;
    return Object.values(p);
  });

  const allParticipants = createMemo((): ParticipantInfo[] => {
    return participants();
  });

  // ── Physics Loop ───────────────────────────────────────────────────────────

  const updatePhysics = () => {
    const mouse = mousePos();

    const updateBody = (body: PhysicsBody) => {
      const dx = body.x - mouse.x;
      const dy = body.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < INFLUENCE_RADIUS && dist > 0) {
        const force = REPULSION_STRENGTH / (dist * dist);
        body.vx += (dx / dist) * force * 0.016;
        body.vy += (dy / dist) * force * 0.016;
      }

      // Spring back to rest
      body.vx += (body.restX - body.x) * SPRING_STIFFNESS;
      body.vy += (body.restY - body.y) * SPRING_STIFFNESS;

      // Damping
      body.vx *= DAMPING;
      body.vy *= DAMPING;

      body.x += body.vx;
      body.y += body.vy;
    };

    updateBody(senderBody);
    for (const body of bodies) {
      updateBody(body);
    }

    animFrame = requestAnimationFrame(updatePhysics);
  };

  onMount(() => {
    // Initialize sender body
    senderBody = { restX: SENDER_X, restY: 200, x: SENDER_X, y: 200, vx: 0, vy: 0 };

    animFrame = requestAnimationFrame(updatePhysics);
  });

  onCleanup(() => {
    if (animFrame) cancelAnimationFrame(animFrame);
  });

  const handleMouseMove = (e: MouseEvent) => {
    if (!svgRef) return;
    const rect = svgRef.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} class="relative w-full">
      {/* File info */}
      <div class="mb-4 text-center">
        <p class="text-sm font-medium text-foreground">{props.session.fileName}</p>
        <p class="text-xs text-muted-foreground">{formatBytes(props.session.fileSize)}</p>
        <Show when={props.session.status === "complete"}>
          <p class="mt-1 text-xs text-success-foreground">All transfers complete</p>
        </Show>
      </div>

      {/* SVG Visualization */}
      <svg
        ref={svgRef}
        viewBox="0 0 600 400"
        class="w-full"
        style={{ "min-height": "300px" }}
        onMouseMove={handleMouseMove}
      >
        {/* Bezier lines */}
        <For each={allParticipants()}>
          {(participant, index) => {
            const y = () => getRecipientY(index(), allParticipants().length);
            const controlX1 = () => SENDER_X + 120;
            const controlX2 = () => RECIPIENT_X - 120;
            const path = () =>
              `M ${senderBody.x} ${senderBody.y} C ${controlX1()} ${senderBody.y}, ${controlX2()} ${y()}, ${RECIPIENT_X} ${y()}`;

            // Update physics bodies
            if (!bodies[index()]) {
              bodies[index()] = {
                restX: RECIPIENT_X,
                restY: y(),
                x: RECIPIENT_X,
                y: y(),
                vx: 0,
                vy: 0,
              };
            }
            bodies[index()]!.restY = y();

            return (
              <>
                {/* Background line */}
                <path
                  d={path()}
                  fill="none"
                  stroke={getLineColor(participant.status)}
                  stroke-width="2"
                  stroke-dasharray={getLineStrokeDash(participant.status)}
                  opacity="0.3"
                />

                {/* Progress fill line */}
                <Show when={participant.status === "downloading" && participant.progress > 0}>
                  <path
                    d={path()}
                    fill="none"
                    stroke={getLineColor(participant.status)}
                    stroke-width="2.5"
                    stroke-dasharray={`${participant.progress * 100}% ${100}%`}
                    pathLength={100}
                  />
                </Show>

                {/* Complete line */}
                <Show when={participant.status === "complete"}>
                  <path
                    d={path()}
                    fill="none"
                    stroke={getLineColor(participant.status)}
                    stroke-width="2.5"
                  />
                </Show>

                {/* Flowing particles for active transfers */}
                <Show when={participant.status === "downloading"}>
                  <circle r="3" fill={getLineColor("downloading")} opacity="0.8">
                    <animateMotion dur="2s" repeatCount="indefinite" path={path()} />
                  </circle>
                  <circle r="2" fill={getLineColor("downloading")} opacity="0.5">
                    <animateMotion dur="2s" repeatCount="indefinite" path={path()} begin="0.7s" />
                  </circle>
                  <circle r="2" fill={getLineColor("downloading")} opacity="0.3">
                    <animateMotion dur="2s" repeatCount="indefinite" path={path()} begin="1.4s" />
                  </circle>
                </Show>
              </>
            );
          }}
        </For>

        {/* Sender avatar */}
        <g transform={`translate(${senderBody.x - AVATAR_SIZE_SENDER / 2}, ${senderBody.y - AVATAR_SIZE_SENDER / 2})`}>
          <circle
            cx={AVATAR_SIZE_SENDER / 2}
            cy={AVATAR_SIZE_SENDER / 2}
            r={AVATAR_SIZE_SENDER / 2}
            fill="oklch(0.21 0.018 155)"
            stroke="oklch(0.66 0.17 155)"
            stroke-width="2"
          />
          <Show
            when={props.session.senderAvatarUrl}
            fallback={
              <text
                x={AVATAR_SIZE_SENDER / 2}
                y={AVATAR_SIZE_SENDER / 2 + 6}
                text-anchor="middle"
                fill="oklch(0.955 0.008 155)"
                font-size="24"
                font-weight="600"
              >
                {(props.session.senderDisplayName ?? props.session.senderUsername ?? "?").charAt(0).toUpperCase()}
              </text>
            }
          >
            {(url) => (
              <>
                <defs>
                  <clipPath id="sender-clip">
                    <circle cx={AVATAR_SIZE_SENDER / 2} cy={AVATAR_SIZE_SENDER / 2} r={AVATAR_SIZE_SENDER / 2 - 1} />
                  </clipPath>
                </defs>
                <image
                  href={url()}
                  x="1"
                  y="1"
                  width={AVATAR_SIZE_SENDER - 2}
                  height={AVATAR_SIZE_SENDER - 2}
                  clip-path="url(#sender-clip)"
                />
              </>
            )}
          </Show>
        </g>

        {/* Sender label */}
        <text
          x={senderBody.x}
          y={senderBody.y + AVATAR_SIZE_SENDER / 2 + 18}
          text-anchor="middle"
          fill="oklch(0.955 0.008 155)"
          font-size="12"
          font-weight="500"
        >
          {props.session.senderDisplayName ?? props.session.senderUsername ?? "You"}
        </text>

        {/* Recipient avatars */}
        <For each={allParticipants()}>
          {(participant, index) => {
            const y = () => getRecipientY(index(), allParticipants().length);
            const body = () => bodies[index()];

            const statusLabel = () => {
              switch (participant.status) {
                case "invited": return "Invited";
                case "joined": return "Joined";
                case "downloading": return `${Math.round(participant.progress * 100)}%`;
                case "complete": return "Shared";
                case "error": return "Error";
                default: return "";
              }
            };

            return (
              <g transform={`translate(${(body()?.x ?? RECIPIENT_X) - AVATAR_SIZE_RECIPIENT / 2}, ${(body()?.y ?? y()) - AVATAR_SIZE_RECIPIENT / 2})`}>
                <circle
                  cx={AVATAR_SIZE_RECIPIENT / 2}
                  cy={AVATAR_SIZE_RECIPIENT / 2}
                  r={AVATAR_SIZE_RECIPIENT / 2}
                  fill="oklch(0.21 0.018 155)"
                  stroke={getLineColor(participant.status)}
                  stroke-width="2"
                />
                <Show
                  when={participant.avatarUrl}
                  fallback={
                    <text
                      x={AVATAR_SIZE_RECIPIENT / 2}
                      y={AVATAR_SIZE_RECIPIENT / 2 + 5}
                      text-anchor="middle"
                      fill="oklch(0.955 0.008 155)"
                      font-size="18"
                      font-weight="600"
                    >
                      {(participant.displayName ?? participant.username ?? "?").charAt(0).toUpperCase()}
                    </text>
                  }
                >
                  {(url) => (
                    <>
                      <defs>
                        <clipPath id={`recipient-clip-${index()}`}>
                          <circle cx={AVATAR_SIZE_RECIPIENT / 2} cy={AVATAR_SIZE_RECIPIENT / 2} r={AVATAR_SIZE_RECIPIENT / 2 - 1} />
                        </clipPath>
                      </defs>
                      <image
                        href={url()}
                        x="1"
                        y="1"
                        width={AVATAR_SIZE_RECIPIENT - 2}
                        height={AVATAR_SIZE_RECIPIENT - 2}
                        clip-path={`url(#recipient-clip-${index()})`}
                      />
                    </>
                  )}
                </Show>

                {/* Username */}
                <text
                  x={AVATAR_SIZE_RECIPIENT / 2}
                  y={AVATAR_SIZE_RECIPIENT + 14}
                  text-anchor="middle"
                  fill="oklch(0.955 0.008 155)"
                  font-size="11"
                  font-weight="500"
                >
                  {participant.displayName ?? participant.username}
                </text>

                {/* Status label */}
                <text
                  x={AVATAR_SIZE_RECIPIENT / 2}
                  y={AVATAR_SIZE_RECIPIENT + 26}
                  text-anchor="middle"
                  fill={getLineColor(participant.status)}
                  font-size="10"
                >
                  {statusLabel()}
                </text>

                {/* Speed for active downloads */}
                <Show when={participant.status === "downloading" && participant.speed > 0}>
                  <text
                    x={AVATAR_SIZE_RECIPIENT / 2}
                    y={AVATAR_SIZE_RECIPIENT + 38}
                    text-anchor="middle"
                    fill="oklch(0.62 0.008 155)"
                    font-size="9"
                  >
                    {formatBytes(participant.speed)}/s
                  </text>
                </Show>
              </g>
            );
          }}
        </For>
      </svg>

      {/* Empty state when no participants */}
      <Show when={allParticipants().length === 0}>
        <div class="flex flex-col items-center justify-center py-8">
          <p class="text-sm text-muted-foreground">Waiting for recipients to join...</p>
        </div>
      </Show>
    </div>
  );
};

export default ShareVisualization;
