import { PanelCard } from "@/components/panel-card";
import { MonoLabel } from "@/components/mono-label";

export function ConversationDemo() {
  return (
    <div className="space-y-4 max-w-[900px] mx-auto">
      {/* User message */}
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-primary/10 border border-primary/20 rounded-lg px-5 py-4">
          <MonoLabel className="text-[10px] mb-2 block">YOU</MonoLabel>
          <p className="font-body text-base leading-relaxed text-foreground">
            Had two CFO calls this week and I think both would pay for the
            compliance module. But I&apos;m also juggling SOC2 docs and the
            pilot feedback has edge cases with the discrepancy workflow.
            I&apos;m not sure everything is landing. Also need to figure out
            the pricing model before the board meeting next Thursday.
          </p>
          <span className="font-mono text-[9px] text-muted mt-2 block">
            2:34 PM
          </span>
        </div>
      </div>

      {/* AI response */}
      <div className="flex justify-start">
        <div className="max-w-[80%] bg-panel border border-border rounded-lg px-5 py-4">
          <MonoLabel className="text-[10px] mb-2 block">TENSIENT</MonoLabel>
          <p className="font-body text-base leading-relaxed text-foreground mb-4">
            Two CFOs expressing willingness to pay is your strongest demand
            signal this quarter -- that validates the entire compliance product
            line. You buried the lead. The SOC2 docs and pilot edge cases are
            parallel tracks, not blockers to each other. Let me reframe your
            week:
          </p>

          <div className="space-y-3">
            <div>
              <MonoLabel className="text-[9px] text-warning mb-1 block">
                ACTION ITEMS
              </MonoLabel>
              <ul className="text-sm text-muted space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-primary shrink-0">→</span>
                  Get written confirmation from both CFOs before Thursday
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary shrink-0">→</span>
                  Prep board pricing slide with two models: per-seat and
                  per-audit
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-warning shrink-0">→</span>
                  Spec the discrepancy workflow fix -- is it engineering
                  capacity or spec clarity?
                </li>
              </ul>
            </div>

            <div>
              <MonoLabel className="text-[9px] text-secondary mb-1 block">
                REFLECT
              </MonoLabel>
              <ul className="text-sm text-muted space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-secondary shrink-0">?</span>
                  If both CFOs commit, does that change your board ask?
                </li>
              </ul>
            </div>

            <div className="border-t border-border pt-2">
              <p className="font-mono text-[10px] text-muted/60">
                <span className="text-primary/60">CANON</span> &mdash; This
                aligns with &quot;Launch compliance automation&quot; (Q1
                priority). Your Brain notes from last week flagged pricing as
                the open question.
              </p>
            </div>
          </div>

          <span className="font-mono text-[9px] text-muted mt-3 block">
            2:34 PM
          </span>
        </div>
      </div>
    </div>
  );
}
