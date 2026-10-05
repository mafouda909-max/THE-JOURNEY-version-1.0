export function providerSignal(signal?: AbortSignal, timeoutMs = 12000): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}
