"use client";

import { useState } from "react";
import { PanelCard } from "@/components/panel-card";
import { MonoLabel } from "@/components/mono-label";

interface Archetype {
  id: string;
  label: string;
  role: string;
  input: string;
  alignment: number;
  alignmentColor: string;
  sentiment: number;
  sentimentColor: string;
  synthesis: string;
  actionItems: { status: string; statusColor: string; task: string }[];
  coaching: string;
}

const archetypes: Archetype[] = [
  {
    id: "engineer",
    label: "THE JARGON ENGINEER",
    role: "Senior Backend Engineer",
    input:
      "Refactored the FHIR R4 adapter to handle ADT A08 messages. Moved to bulk $export with NDJSON batching. Fixed the websocket race condition with SELECT FOR UPDATE on shift_id. Also started the AES-256 encryption migration for SOC2. PRs are up, need reviews.",
    alignment: 41,
    alignmentColor: "text-yellow-400",
    sentiment: 0.1,
    sentimentColor: "text-muted",
    synthesis:
      "Completed critical hospital data integration work (FHIR adapter) that directly supports credential verification pilot. Fixed a production bug affecting 3 customer accounts. Progressing on SOC2 encryption requirements.",
    actionItems: [
      { status: "DONE", statusColor: "text-primary", task: "FHIR adapter refactor shipped" },
      { status: "DONE", statusColor: "text-primary", task: "Shift notification bug resolved" },
      { status: "BLOCKED", statusColor: "text-red-400", task: "4 PRs awaiting review for 3+ days" },
      { status: "OPEN", statusColor: "text-yellow-400", task: "AES-256 migration in progress" },
    ],
    coaching:
      "I translated your technical work into business impact. The FHIR adapter refactor directly unblocks 3 pilot deployments -- I've led with that in your synthesis so leadership sees the strategic value immediately. I also flagged your PR review bottleneck as a blocker since it's been 3+ days.",
  },
  {
    id: "csm",
    label: "THE DROWNING CSM",
    role: "Customer Success Lead",
    input:
      "Memorial Health is in trouble, new CTO wants a bake-off and I can't get a meeting. Notification tickets still open after 2 weeks, escalated 3 times. Kaiser wants 15% discount on renewal. St. David's went dark. I have 22 accounts and 4 are on fire. I need help.",
    alignment: 34,
    alignmentColor: "text-red-400",
    sentiment: -0.6,
    sentimentColor: "text-red-400",
    synthesis:
      "4 of 22 accounts at risk. Memorial Health facing competitive evaluation. Kaiser renewal requires discount negotiation. St. David's usage collapsed. Support ticket backlog eroding trust at 3 accounts.",
    actionItems: [
      { status: "ESCALATE", statusColor: "text-red-400", task: "Memorial Health needs executive outreach from CEO" },
      { status: "BLOCKED", statusColor: "text-red-400", task: "3 notification tickets unresolved for 2 weeks" },
      { status: "OPEN", statusColor: "text-yellow-400", task: "Kaiser renewal negotiation (target: 5% max discount)" },
      { status: "OPEN", statusColor: "text-yellow-400", task: "Re-engage St. David's -- identify new power user" },
    ],
    coaching:
      "I organized your account risks by severity and flagged Memorial Health for executive outreach -- that one needs your CEO, not just you. The pattern across your accounts points to a capacity issue, not a performance one. I've framed it that way in the synthesis so leadership sees the systemic problem.",
  },
  {
    id: "underseller",
    label: "THE UNDERSELLER",
    role: "Product Manager",
    input:
      "Had a bunch of customer calls this week I guess. Two CFOs said they'd pay for the compliance module. Also finished the product brief and got it approved. The pilot feedback is mostly positive but there are some edge cases with the discrepancy workflow. I'm juggling the SOC2 docs and the new product scope at the same time and it's a lot. Not sure everything is landing.",
    alignment: 68,
    alignmentColor: "text-primary",
    sentiment: -0.1,
    sentimentColor: "text-yellow-400",
    synthesis:
      "Validated compliance automation demand with 2 paying-intent signals from hospital CFOs. Product brief approved for second product line. Adventist pilot feedback positive with one UX gap identified. SOC2 documentation on track.",
    actionItems: [
      { status: "DONE", statusColor: "text-primary", task: "Compliance automation product brief approved" },
      { status: "DONE", statusColor: "text-primary", task: "2 CFOs confirmed willingness to pay for compliance module" },
      { status: "OPEN", statusColor: "text-yellow-400", task: "Spec the credential discrepancy resolution workflow" },
      { status: "OPEN", statusColor: "text-yellow-400", task: "Complete final SOC2 process doc (vendor review procedures)" },
    ],
    coaching:
      "Two CFOs saying they'd pay is a major demand signal -- I elevated that to the top of your synthesis because it validates the entire second product line. You buried the lead. I also reframed your workload concern as parallel progress on two strategic tracks, not scattered effort.",
  },
];

export function ArchetypeTabs() {
  const [activeId, setActiveId] = useState(archetypes[0].id);
  const active = archetypes.find((a) => a.id === activeId)!;

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {archetypes.map((arch) => (
          <button
            key={arch.id}
            onClick={() => setActiveId(arch.id)}
            className={`font-mono text-sm uppercase tracking-widest px-4 py-2 rounded-sm border transition-colors cursor-pointer ${
              activeId === arch.id
                ? "border-primary text-primary bg-primary/10"
                : "border-border text-muted hover:text-foreground hover:border-foreground/30"
            }`}
          >
            {arch.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Before: Raw Input */}
        <PanelCard>
          <div className="flex items-baseline justify-between mb-4">
            <MonoLabel className="block text-muted">RAW UPDATE</MonoLabel>
            <span className="font-mono text-xs text-muted">{active.role}</span>
          </div>
          <p className="font-body text-base leading-relaxed text-muted italic">
            &quot;{active.input}&quot;
          </p>
        </PanelCard>

        {/* After: Structured Artifact */}
        <PanelCard className="border-primary/30">
          <MonoLabel className="mb-4 block text-primary">
            WHAT TENSIENT PRODUCES
          </MonoLabel>

          {/* Scores Row */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="text-center">
              <span className="font-mono text-xs text-muted block mb-1">
                ALIGNMENT
              </span>
              <span className={`font-mono text-xl font-bold ${active.alignmentColor}`}>
                {active.alignment}%
              </span>
            </div>
            <div className="text-center">
              <span className="font-mono text-xs text-muted block mb-1">
                SENTIMENT
              </span>
              <span className={`font-mono text-xl font-bold ${active.sentimentColor}`}>
                {active.sentiment.toFixed(1)}
              </span>
            </div>
          </div>

          <div className="border-t border-border pt-3 mb-3">
            <span className="font-mono text-xs text-muted block mb-2">
              AI COACH
            </span>
            <p className="font-body text-base leading-relaxed text-foreground">
              {active.coaching}
            </p>
          </div>

          <div className="border-t border-border pt-3 mb-3">
            <span className="font-mono text-xs text-muted block mb-2">
              ELEVATED SYNTHESIS
            </span>
            <p className="font-body text-base leading-relaxed text-muted">
              {active.synthesis}
            </p>
          </div>

          <div className="border-t border-border pt-3">
            <span className="font-mono text-xs text-muted block mb-2">
              ACTION ITEMS
            </span>
            <ul className="space-y-1">
              {active.actionItems.map((item, i) => (
                <li
                  key={i}
                  className="font-body text-base text-foreground flex items-start gap-2"
                >
                  <span className={`${item.statusColor} font-mono text-sm mt-0.5 shrink-0`}>
                    {item.status}
                  </span>
                  <span>{item.task}</span>
                </li>
              ))}
            </ul>
          </div>
        </PanelCard>
      </div>
    </div>
  );
}
