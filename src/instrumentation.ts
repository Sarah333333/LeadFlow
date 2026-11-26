// Catches every unhandled server error (pages, actions, route handlers) and logs it in redacted JSON.
// To add Sentry later: install @sentry/nextjs and call Sentry.captureRequestError here.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { checkEnvironment } = await import("@/lib/env-check");
  const { log } = await import("@/lib/log");
  const { errors, warnings } = checkEnvironment();
  warnings.forEach((w) => log.warn("config.warning", { issue: w }));
  if (errors.length) {
    errors.forEach((e) => log.error("config.error", { issue: e }));
    // Refuse to serve a misconfigured production deployment.
    if (process.env.NODE_ENV === "production") throw new Error(`Refusing to start: ${errors.length} configuration error(s) — see logs`);
  }
}

export async function onRequestError(err: unknown, request: { path: string; method: string }, context: { routeType: string }) {
  const { log } = await import("@/lib/log");
  log.error("request.unhandled_error", { path: request.path.split("?")[0], method: request.method, routeType: context.routeType, error: err });
}
