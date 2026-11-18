// One bench job per message on a worker thread: a seed-year under today's rule, or with the noise band's day-1
// food nudge on the k-th person by id (docs/specs/vulcan-bench.md "Measures"). Each worker loads Vulcan once.
import { parentPort, workerData } from "node:worker_threads";
import { loadVulcan } from "./engine.ts";
import { runJob, type Job } from "./bench.ts";

const vulcan = await loadVulcan(workerData.dir);
parentPort!.on("message", (job: Job) => parentPort!.postMessage(runJob(vulcan.engine, job)));
parentPort!.postMessage("ready");
