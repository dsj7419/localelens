/**
 * Project Layout
 *
 * Wraps project pages with error boundary for graceful error handling.
 */

import { ErrorBoundary } from "~/components/ErrorBoundary";

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
