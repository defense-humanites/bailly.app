/**
 * Mounts after the hydration, one at a time, each in a task of its own (cf.
 * `DeferredClientOnly`): the hydration's task, and each mount's, stay short,
 * and a tap meanwhile is handled between them rather than after the whole
 * (cf. `audit-inp.md`). In the order of their priority (lowest first), then
 * of their call.
 */
interface Job {
  priority: number;
  run: () => void;
}

const queue: Job[] = [];
let draining = false;

/** A new task: the browser handles input and may render in between. */
const nextTask = (): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, 0);
});

const drain = async (): Promise<void> => {
  draining = true;
  while (queue.length > 0) {
    await nextTask();
    // Vue renders the change in a microtask, still within this task.
    queue.shift()?.run();
  }
  draining = false;
};

/**
 * Runs `run` in a task of its own once the current one is over, after the
 * jobs of a lower or equal priority; returns a function cancelling it.
 */
export function deferMount(run: () => void, priority = 0): () => void {
  const job: Job = { priority, run };
  const index = queue.findIndex(other => other.priority > priority);
  queue.splice(index === -1 ? queue.length : index, 0, job);
  if (!draining) void drain();
  return () => {
    const at = queue.indexOf(job);
    if (at !== -1) queue.splice(at, 1);
  };
}
