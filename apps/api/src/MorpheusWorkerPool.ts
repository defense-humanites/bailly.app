import { MorpheusWorker } from "./MorpheusWorker.ts";
import { Settings } from "./Settings.ts";

export class MorpheusWorkerPool {
  #idle: MorpheusWorker[] = [];
  #waiters: Array<(worker: MorpheusWorker) => void> = [];

  #args: string[];

  constructor(args: string[]) {
    const settings = Settings.getSettings();
    this.#args = [...args];

    for (let i = 0; i < settings.morpheusPoolSize; i++) {
      this.#idle.push(this.#spawn());
    }
  }

  #spawn(): MorpheusWorker {
    return MorpheusWorker.spawn(this.#args);
  }

  #acquire(): Promise<MorpheusWorker> {
    const worker = this.#idle.shift();

    if (worker) return Promise.resolve(worker);

    return new Promise((resolve) => {
      this.#waiters.push(resolve);
    });
  }

  #release(worker: MorpheusWorker): void {
    const waiter = this.#waiters.shift();

    if (waiter) waiter(worker);
    else this.#idle.push(worker);
  }

  async analyze(
    betaCodeStr: string,
    timeout: number
  ): Promise<string> {
    const worker = await this.#acquire();

    try {
      const result = await worker.analyze(
        betaCodeStr,
        timeout
      );

      this.#release(worker);

      return result;
    } catch (error) {
      await worker.kill();

      const replacement = this.#spawn();
      this.#release(replacement);

      throw error;
    }
  }
}
