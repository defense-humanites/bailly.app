import { TextLineStream } from "@std/streams";
import { Settings } from "./Settings.ts";

const SENTINEL = "#__MORPHEUS_END__";

export class MorpheusWorker {
  #writer: WritableStreamDefaultWriter<Uint8Array>;
  #lineReader: ReadableStreamDefaultReader<string>;
  #encoder = new TextEncoder();
  #process: Deno.ChildProcess;

  private constructor(
    process: Deno.ChildProcess,
    writer: WritableStreamDefaultWriter<Uint8Array>,
    lineReader: ReadableStreamDefaultReader<string>
  ) {
    this.#process = process;
    this.#writer = writer;
    this.#lineReader = lineReader;
  }

  static spawn(
    args: string[]
  ): MorpheusWorker {
    const settings = Settings.getSettings();

    const command = new Deno.Command("stdbuf", {
      args: [
        "-o0",
        "-e0",
        settings.morpheusBinaryPath,
        ...args
      ],
      env: {
        MORPHLIB: settings.morpheusStemlibPath
      },
      stdin: "piped",
      stdout: "piped",
      stderr: "null"
    });

    const process = command.spawn();

    const writer = process.stdin.getWriter();

    const lineReader = process.stdout
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new TextLineStream())
      .getReader();

    return new MorpheusWorker(
      process,
      writer,
      lineReader
    );
  }

  async analyze(
    betaCodeStr: string,
    timeout: number
  ): Promise<string> {
    const operation = this.#analyze(betaCodeStr);

    let timer: number | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error("Morpheus worker timed out"));
      }, timeout);
    });

    try {
      return await Promise.race([
        operation,
        timeoutPromise
      ]);
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }

  async #analyze(betaCodeStr: string): Promise<string> {
    await this.#writer.write(
      this.#encoder.encode(
        `${betaCodeStr}\n${SENTINEL}\n`
      )
    );

    const collected: string[] = [];

    while (true) {
      const { value, done } = await this.#lineReader.read();
      if (done) throw new Error("Morpheus worker process ended unexpectedly");
      if (value === SENTINEL) break;
      collected.push(value);
    }

    return collected.join("\n");
  }

  async kill(): Promise<void> {
    try {
      this.#process.kill("SIGKILL");
    } catch {
      // Already dead.
    }

    await this.#process.status.catch(() => {});
  }
}
