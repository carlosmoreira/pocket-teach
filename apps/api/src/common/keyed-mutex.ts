// Serializes async work per key so concurrent mutations of the same project
// workspace (parallel agent tool calls, two open tabs) can't interleave their
// read-modify-write of the lesson index or race git's index.lock.
export class KeyedMutex {
  private readonly chains = new Map<string, Promise<unknown>>();

  run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.chains.get(key) ?? Promise.resolve();
    const result = prev.then(fn, fn);
    this.chains.set(
      key,
      result.then(
        () => undefined,
        () => undefined,
      ),
    );
    return result;
  }
}
