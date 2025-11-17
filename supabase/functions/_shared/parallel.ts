/**
 * Parallel processing utilities for concurrent operations
 */

/**
 * Execute multiple promises in parallel with concurrency limit
 */
export async function parallelLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number = 3
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const promise = task().then((result) => {
      results.push(result);
      executing.splice(executing.indexOf(promise), 1);
    });

    executing.push(promise);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Execute promises in parallel and return first successful result
 */
export async function raceToSuccess<T>(
  tasks: Array<() => Promise<T>>,
  timeoutMs: number = 30000
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Timeout waiting for result')), timeoutMs);
  });

  const taskPromises = tasks.map((task) => task());

  return Promise.race([...taskPromises, timeoutPromise]);
}

/**
 * Execute promises in parallel and return all results (including errors)
 */
export async function parallelAllSettled<T>(
  tasks: Array<() => Promise<T>>
): Promise<Array<{ status: 'fulfilled' | 'rejected'; value?: T; error?: Error }>> {
  const results = await Promise.allSettled(tasks.map((task) => task()));

  return results.map((result) => {
    if (result.status === 'fulfilled') {
      return { status: 'fulfilled' as const, value: result.value };
    } else {
      return {
        status: 'rejected' as const,
        error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
      };
    }
  });
}

/**
 * Batch process items with parallel execution
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 5
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }

  return results;
}




