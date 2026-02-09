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
      "Your work is high-impact but your updates read like a git log. Lead with business outcomes: \"Hospital data integration is now 2x faster, unblocking 3 pilot deployments.\" The people who fund your projects can't parse FHIR and ADT A08.",
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
      "You're firefighting, not strategizing. Escalate the systemic issue: you need a second CSM hire or a product-led approach to reduce support burden. Present the data to leadership -- 4 accounts at risk is a revenue problem, not a personal one.",
  },
  {
    id: "junior",
    label: "THE ANXIOUS JUNIOR",
    role: "Frontend Engineer",
    input:
      "The credential dashboard is mostly working I think? The card components and admin table are done. But the bundle went from 340kb to 510kb after the compliance module and I'm not sure if that's bad. Also the accessibility audit found issues. Should I be worried? I keep bouncing between tasks and I'm not sure what to focus on.",
    alignment: 62,
    alignmentColor: "text-yellow-400",
    sentiment: -0.2,
    sentimentColor: "text-yellow-400",
    synthesis:
      "Credential dashboard core components shipped and tested in pilot. Identified bundle size regression (+50%) and 4 accessibility gaps. Needs clearer prioritization across competing workstreams.",
    actionItems: [
      { status: "DONE", statusColor: "text-primary", task: "Credential dashboard cards and admin table shipped" },
      { status: "OPEN", statusColor: "text-yellow-400", task: "Bundle size optimization (lazy-load compliance module)" },
      { status: "OPEN", statusColor: "text-yellow-400", task: "Fix 4 WCAG contrast issues in status indicators" },
      { status: "OPEN", statusColor: "text-yellow-400", task: "Shift calendar keyboard navigation (60% complete)" },
    ],
    coaching:
      "Stop framing progress as uncertainty. You shipped the core dashboard that the pilot depends on -- that's a win. On bundle size: propose Option 1 (lazy loading) to your lead with data. Making a recommendation is better than asking \"should I be worried?\"",
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
              SYNTHESIZED UPDATE
            </span>
            <p className="font-body text-base leading-relaxed text-foreground">
              {active.synthesis}
            </p>
          </div>

          <div className="border-t border-border pt-3 mb-3">
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

          <div className="border-t border-border pt-3">
            <span className="font-mono text-xs text-muted block mb-2">
              COACHING
            </span>
            <p className="font-body text-base leading-relaxed text-muted">
              {active.coaching}
            </p>
          </div>
        </PanelCard>
      </div>
    </div>
  );
}
