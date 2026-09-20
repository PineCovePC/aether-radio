import { createFileRoute } from "@tanstack/react-router";
import { RadioApp } from "@/components/radio-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <RadioApp />;
}
