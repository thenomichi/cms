"use client";

import { UPLOAD_RULES, describeRules, type UploadKind } from "@/lib/storage/upload-rules";
import { cn } from "@/lib/utils";

interface Props {
  kind: UploadKind;
  className?: string;
}

export function UploadGuidelines({ kind, className }: Props) {
  const rule = UPLOAD_RULES[kind];
  const summary = describeRules(kind);
  return (
    <div className={cn("text-xs text-mid space-y-0.5", className)}>
      <p>{summary}</p>
      <p>
        Recommended: {rule.guidelines.recommendedResolution} ·{" "}
        {rule.guidelines.aspectGuidance}
      </p>
      {rule.guidelines.notes && <p className="text-fog">{rule.guidelines.notes}</p>}
    </div>
  );
}
