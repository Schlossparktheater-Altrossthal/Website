type TrackFn = (request: Request) => void;
type FinalizeFn = (request: Request, response: Response) => void;

let _trackRequest: TrackFn | null = null;
let _finalizeRequest: FinalizeFn | null = null;

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const mod = await import("./instrumentation.node");
    _trackRequest = mod.trackRequest;
    _finalizeRequest = mod.finalizeRequest;
  }
}

export function onRequest(event: { request: Request }) {
  _trackRequest?.(event.request);
}

export function onResponse(event: { request: Request; response: Response }) {
  if (!event?.response) return;
  _finalizeRequest?.(event.request, event.response);
}
