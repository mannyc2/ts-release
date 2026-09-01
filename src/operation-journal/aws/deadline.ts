export const operationJournalNetworkDeadlineMilliseconds = 10_000

export class OperationJournalNetworkDeadlineExceeded extends Error {
  readonly name = "OperationJournalNetworkDeadlineExceeded"

  constructor() {
    super("The operational-journal network deadline elapsed.")
  }
}

/**
 * Bound one complete network operation even when the underlying transport
 * ignores AbortSignal. The signal still gives cooperative transports an
 * immediate opportunity to close DNS, sockets, and response streams.
 */
export const withOperationJournalNetworkDeadline = async <Value>(
  run: (signal: AbortSignal) => Promise<Value>,
  milliseconds = operationJournalNetworkDeadlineMilliseconds
): Promise<Value> => {
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 1 ||
      milliseconds > operationJournalNetworkDeadlineMilliseconds) {
    throw new Error("The operational-journal network deadline is not canonical.")
  }
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const cause = new OperationJournalNetworkDeadlineExceeded()
      controller.abort(cause)
      reject(cause)
    }, milliseconds)
  })
  try {
    return await Promise.race([
      Promise.resolve().then(() => run(controller.signal)),
      deadline
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}
