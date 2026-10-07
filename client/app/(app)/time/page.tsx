import type { Metadata } from "next";
import { TimeView } from "@/components/time/time-view";

export const metadata: Metadata = { title: "Time · Paylancr" };

export default function TimePage() {
  return <TimeView />;
}
