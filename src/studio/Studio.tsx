"use client";

import { useMemo } from "react";
import { NextStudio } from "next-sanity/studio";
import { studioConfig } from "@/studio/sanity.config";

// The embedded Studio, configured with the project settings its server page reads from the environment.
export function Studio({ projectId, dataset }: { projectId: string; dataset: string }) {
  const config = useMemo(() => studioConfig(projectId, dataset), [projectId, dataset]);
  return <NextStudio config={config} />;
}
