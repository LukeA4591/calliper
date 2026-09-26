"use client";

import { useState } from "react";
import { ArrowUpRight, Crosshair, FileText, TriangleAlert } from "lucide-react";

const examples = [
  {
    id: "hole",
    number: "01",
    title: "A deeper look at this hole",
    severity: "high",
    quote: "Ø4 · DEPTH 16",
    detail:
      "16 ÷ 4 = 4:1. A deep blind hole deserves a closer look at tool reach and chip evacuation.",
  },
  {
    id: "tolerance",
    number: "02",
    title: "A small note. A big question.",
    severity: "medium",
    quote: "GENERAL TOLERANCE —",
    detail:
      "No general tolerance is stated. Calliper flags the missing specification and provisionally assumes ISO 2768-m.",
  },
] as const;

export function DrawingPreview() {
  const [selected, setSelected] = useState(0);
  const issue = examples[selected];
  return (
    <div className="landing-preview" id="drawing-preview">
      <div className="preview-topline">
        <span>
          <FileText size={14} /> FLANGE / REV A
        </span>
        <span>Interactive example</span>
      </div>
      <div className="preview-sheet">
        <svg
          viewBox="0 0 560 370"
          role="img"
          aria-label="Illustrative flange drawing with a blind hole callout and an incomplete tolerance field"
        >
          <defs>
            <pattern
              id="drawing-hatch"
              width="7"
              height="7"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="7"
                stroke="currentColor"
                strokeWidth="0.6"
              />
            </pattern>
          </defs>
          <g fill="none" stroke="currentColor" strokeWidth="1.4">
            <path
              d="M112 70 H328 L362 104 V236 L328 270 H112 L78 236 V104 Z"
              fill="url(#drawing-hatch)"
            />
            <path
              d="M128 94 H312 L338 120 V220 L312 246 H128 L102 220 V120 Z"
              fill="var(--surface)"
            />
            <circle cx="220" cy="170" r="65" fill="var(--surface)" />
            <circle cx="220" cy="170" r="44" />
            <circle cx="128" cy="120" r="10" />
            <circle cx="312" cy="120" r="10" />
            <circle cx="128" cy="220" r="10" />
            <circle cx="312" cy="220" r="10" />
            <path d="M210 170 H230 M220 160 V180" strokeWidth="0.7" />
            <path
              d="M60 170 H380 M220 53 V287"
              strokeDasharray="10 4 2 4"
              strokeWidth="0.6"
            />
            <path
              d="M78 48 V66 M362 48 V100 M78 51 H362 M74 55 L82 47 M358 55 L366 47"
              strokeWidth="0.8"
            />
            <path
              d="M45 70 H73 M45 270 H108 M50 70 V270 M46 74 L54 66 M46 274 L54 266"
              strokeWidth="0.8"
            />
            <path
              d="M316 116 L388 76 H508 M316 220 L398 204 H508"
              strokeWidth="0.8"
            />
            <path
              d="M78 307 H508 M78 336 H508 M310 307 V355 M78 355 H508"
              strokeWidth="0.6"
            />
          </g>
          <g fill="currentColor" fontFamily="inherit" fontSize="10">
            <text x="220" y="43" textAnchor="middle">
              80
            </text>
            <text x="40" y="175" transform="rotate(-90 40 175)">
              60
            </text>
            <text x="396" y="66">
              4 × Ø4
            </text>
            <text x="398" y="193">
              Ø4 · DEPTH 16
            </text>
            <text x="90" y="326">
              MATERIAL: ALUMINIUM
            </text>
            <text x="322" y="326">
              GENERAL TOLERANCE
            </text>
            <text x="90" y="350">
              FINISH: MACHINED
            </text>
            <text x="322" y="350">
              —
            </text>
            <text x="80" y="290" fontSize="8">
              FRONT VIEW
            </text>
          </g>
          <rect
            x="382"
            y="171"
            width="137"
            height="41"
            rx="4"
            className={`preview-region preview-region-high ${selected === 0 ? "active" : ""}`}
          />
          <rect
            x="312"
            y="309"
            width="205"
            height="48"
            rx="4"
            className={`preview-region preview-region-medium ${selected === 1 ? "active" : ""}`}
          />
        </svg>
        <button
          className="preview-pin preview-pin-hole"
          aria-label="Inspect blind hole issue"
          aria-pressed={selected === 0}
          onClick={() => setSelected(0)}
        >
          01 <Crosshair size={13} />
        </button>
        <button
          className="preview-pin preview-pin-tolerance"
          aria-label="Inspect missing tolerance issue"
          aria-pressed={selected === 1}
          onClick={() => setSelected(1)}
        >
          02 <Crosshair size={13} />
        </button>
      </div>
      <div className="preview-insight" aria-live="polite" aria-atomic="true">
        <div className="preview-insight-label">
          <span>
            <TriangleAlert size={13} /> {issue.severity} priority
          </span>
          <span>{issue.number} / 02</span>
        </div>
        <h3>{issue.title}</h3>
        <p>{issue.detail}</p>
        <div className="preview-insight-bottom">
          <code>{issue.quote}</code>
          <button onClick={() => setSelected(selected === 0 ? 1 : 0)}>
            Next finding <ArrowUpRight size={14} />
          </button>
        </div>
      </div>
      <p className="preview-caption">
        Click a numbered marker to explore · illustrative findings
      </p>
    </div>
  );
}
