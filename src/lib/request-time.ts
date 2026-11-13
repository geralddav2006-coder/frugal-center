/**
 * Time of the current server render. Routes in this app are rendered
 * dynamically per request, so reading the clock here is intentional.
 */
export function requestTime(): number {
  return Date.now();
}
