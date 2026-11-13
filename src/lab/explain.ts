// Teaching layer for each Lab tab (D-015, docs/UI_STYLE.md "Teaching layer"), from the approved mock-up
// (mockups/lab.html). Every fact traces to docs/specs/first-usable.md; edit both together.
export type Explain = { what: string; tryit: string; deep: string; words: [string, string][] };

export const EXPLAIN: Record<string, Explain> = {
  live: {
    what: "A tank of water. A valve at the top lets water in; a hole at the bottom lets it out, faster when the tank is fuller. A controller called a PI (explained under How it works) opens and closes the valve to hold the water level at the setpoint you choose.",
    tryit: "Drag the setpoint from 1.00 to 1.50 m. The valve opens wide, the level climbs, and the valve eases back as the level arrives. Then tap Disturbance: the outlet drains 20% faster for 60 s, the level dips, and the PI opens the valve further to win it back.",
    deep: `<p><b>The error.</b> Every 0.1 s the PI reads the level and works out the error: setpoint minus level. The box below shows the PI's sums right now.</p>
      <div class="now" id="pi-now" aria-live="off"></div>
      <p><b>P, the proportional part.</b> P = Kp × error, with the gain Kp = 1.0. A big error opens the valve a lot right now. On its own it would stop short of the setpoint, because once the error shrinks the push shrinks too.</p>
      <p><b>I, the integral part.</b> I adds up the error over time: each step it grows by (Kp ÷ Ti) × error × 0.1 s. While any error remains it keeps nudging the valve, so the level settles on the setpoint, give or take the sensor noise. Ti = 40 s here: with a steady error, I takes 40 s to grow as large as P's push.</p>
      <p><b>Valve = P + I</b>, kept between 0 (shut) and 1 (fully open). When the valve is pinned at 0 or 1, I stops adding up. Otherwise it would pile up error it can't act on and overshoot later. This is called anti-windup.</p>
      <p><b>Why one tuning isn't right everywhere.</b> Water leaves at k × √level (k = 0.05). A fuller tank drains faster, so the tank reacts differently at 0.25 m than at 1.75 m. The tuning rule used here gives Ti = 40 × √level seconds: 20 s at 0.25 m, 40 s at 1.0 m, about 53 s at 1.75 m. This PI uses 40 s everywhere. The Fixed test tab measures what that costs, and Phobos asks whether a small neural net can do better.</p>
      <p><b>The tank.</b> Floor area 1 m², 2 m tall. Full valve lets in 0.1 m³/s, so holding 1.0 m needs the valve half open. The level sensor adds up to ±5 mm of noise; the PI reacts to it, so the valve twitches slightly all the time. The simulation runs 10 times faster than real time.</p>`,
    words: [
      ["Setpoint", "the level you ask for"],
      ["PI", "a controller with a proportional (P) and an integral (I) part. Many controllers add a third, derivative (D) part; this one doesn't"],
      ["Kp", "the gain: how hard P pushes per metre of error"],
      ["Disturbance", "something outside the controller that upsets the tank"],
    ],
  },
  fixed: {
    what: "The same five tests every run, so controllers can be compared fairly. Each test starts the tank steady, then either changes the setpoint or upsets the tank. Each bar is an error score: how far the level strayed from the setpoint, and for how long. A shorter bar is better.",
    tryit: "Compare the two bars in each row. On 0.50→0.25 the PI tuned for that level scores about half. On 0.25→1.00 and dist@1.00 the bars match, because at 1.00 m both PIs are tuned the same. On 1.00→1.75 the retuned PI does worse: How it works explains why.",
    deep: `<p><b>IAE</b> (integrated absolute error) is the error score on the bars: the area between the level and the setpoint over the 300 s test. 1 m off for 1 s adds 1 m·s; 1 cm off for 100 s adds 1 m·s too. Lower means the level stayed closer to where you asked. It is measured on the true level, not the noisy reading the PI sees.</p>
      <p><b>Fixed PI</b> ("tuned once") uses Ti = 40 s, tuned for 1.0 m. <b>Retuned PI</b> ("retuned") gets Ti = 40 × √target, worked out for each test's target level in advance, as an engineer would with the textbook rule.</p>
      <p><b>Why 5 seeds.</b> Sensor noise is random. Each test runs with noise seeds 1 to 5 and the bar shows the mean, so one lucky run can't decide the result. Both PIs get exactly the same noise.</p>
      <p><b>Valve travel</b> adds up every movement of the valve. A controller that twitches the valve wears out a real one, so the verdict limits it. Here most of it is the PI reacting to sensor noise: with the noise switched off, each test's travel is under 1.3 instead of about 10.</p>
      <p><b>The surprise.</b> On 1.00→1.75 the retuned PI scores worse (11.79 against 9.74 m·s). Its Ti there is about 53 s, so its I part builds more slowly than the fixed PI's. The textbook rule (IMC, λ = 10 s) picks Ti for a target response speed; a lower error score is a different goal.</p>`,
    words: [
      ["dist@1.00", "hold 1.00 m while the outlet drains 20% faster from 60 s to 120 s"],
      ["Seed", "the number that fixes a random sequence, so a run can be repeated exactly"],
    ],
  },
  tables: {
    what: "A neural net needs two curves. tanh is an S shape that squashes any number into the range −1 to 1. exp falls from 1 towards 0. Working curves like these out exactly needs decimal maths, and different devices can disagree in the last digit. So Phobos works each curve out once, saves 1,025 points along it as whole numbers (a table), and later just looks up the two nearest points. Every device then gets exactly the same answer.",
    tryit: "In the chart, look for any gap between a solid line (read from the table) and its dashed line (the exact curve). You won't see one: the table is never off by more than 1 step, and a step is about 0.0002, far thinner than the line.",
    deep: `<p><b>The chart.</b> Left to right is the input, from −8 to +8. Up and down is the answer, from −1 to 1. The S-shaped line is tanh; the line that rises from near 0 to 1 on the left half and then stays flat is exp.</p>
      <p><b>Whole numbers for fractions.</b> Phobos stores 1.0 as 4096, so 0.5 is 2048 and −0.25 is −1024. Divide by 4,096 to get the real value back. The numbers fit in 16 bits, so they run from −8 to just under 8. The smallest change, 1 ÷ 4,096 ≈ 0.00024, is one step; engineers call it an LSB. This format is called Q12.</p>
      <p><b>What is saved.</b> Each table holds the curve at 1,025 evenly spaced inputs from 0 to 8, one every 1/128. The small table above shows five of them. For example at input 1: tanh(1) = 0.761594, and 0.761594 × 4,096 = 3119.49, which rounds to 3119. exp(−1) = 0.367879, and 0.367879 × 4,096 = 1506.83, which rounds to 1507.</p>
      <p><b>Reading between points.</b> Most inputs fall between two saved points. Phobos draws a straight line between the two and reads off the height, using only adding, multiplying and shifting bits, no decimal maths. The points are so close together that the straight piece and the true curve almost match. Negative inputs reuse the tanh table with the sign flipped, because tanh is the same shape upside down on that side.</p>
      <p><b>The check.</b> Every one of the 65,536 possible inputs is compared with the exact curve. The table must be within 2 LSB; it is within 1 LSB for tanh and 1 for exp. As a share of the curve's height that is 0.012% for tanh and 0.024% for exp. The page works these numbers out again when it opens.</p>
      <p><b>exp</b> is only needed for inputs of 0 or below (falling from 1 at 0 towards 0 at −8), so its table covers that half and any positive input gives 1.</p>`,
    words: [
      ["tanh", "hyperbolic tangent, the S-shaped squashing curve"],
      ["exp", "the exponential curve; here only its falling half"],
      ["Table", "a list of saved points along a curve"],
      ["LSB", "least significant bit: the smallest step a whole number can take, here 1/4,096"],
    ],
  },
  ivf: {
    what: "Phobos runs its nets with whole numbers, so every device gets exactly the same answer. This tab checks that the whole-number answer stays close to the answer from ordinary decimal maths. Two small nets filled with random numbers are worked out both ways on 1,000 saved tank situations, and the table shows how far apart the two answers get.",
    tryit: "Compare each Result with its Limit: every row passes with lots of room. In the chart, look for a gap between the solid line (whole numbers) and the dashed line (decimal maths). The biggest gap is printed under the chart, far below the 0.01 allowed.",
    deep: `<p><b>The chart.</b> Left to right are the 1,000 saved situations in order: the five tests from the Fixed test tab, 200 situations each, one every 1.5 s. The thin upright lines split the five tests. Up and down is the valve opening the Lab-shaped net asks for. Its numbers are random, not trained, so it doesn't control the tank well and its valve barely moves. That is fine: this tab checks the arithmetic, not the control.</p>
      <p><b>A worked example</b>, the first situation, worked out by this page just now:</p>
      <div class="now" id="ivf-example" aria-live="off"></div>
      <p><b>A dense layer</b> works out each output like this: multiply every input by its own weight, add the results, add a bias, then squash the total through tanh (see the Tables tab). "4→16" means 4 inputs in and 16 outputs out. In whole numbers each weight is stored multiplied by a power of two, for example × 16,384, and the total is shifted back down afterwards, dropping the leftover fraction. That dropped fraction, plus the tanh table's tiny misses, is all that separates the two versions.</p>
      <p><b>Layer gap.</b> For each layer: the biggest difference between the two versions over the 1,000 situations, as a share of how far that layer's output can swing. A tanh output swings from −1 to 1, a swing of 2, so a gap of 0.02 would be 1%. Both versions of a layer are given the same input (the whole-number output of the layer before), so the gap belongs to that layer alone. The limit is 1%.</p>
      <p><b>The test net</b> picks one of 5 actions (numbered 0 to 4) instead of setting a valve. Its last layer has no squash: its 5 outputs are scores, and the highest score wins. Action 4 is forbidden, so it is never picked however high it scores; this is called a mask. If two scores tie, the lower-numbered action wins. Both versions must pick the same action in at least 99% of the situations. <span id="ivf-actions"></span></p>
      <p><b>The Lab-shaped net</b> has the shape the trained net will have: 4 inputs (setpoint, level, error, and the error added up over time ÷ 32), 16 numbers in the middle, 1 output that sets the valve. That is 97 weights and biases in all. Its valve must be within 0.01 of the decimal version in at least 99% of the situations.</p>
      <p><b>Why whole numbers at all.</b> Adding and multiplying decimals gives the same answer on every computer, but curves like tanh and exp can differ in the last digit between versions. Some targets also have no decimal maths: the Vulcan game engine bans these curves, and plant controllers often work in whole numbers. Whole numbers plus lookup tables give the same result everywhere.</p>
      <p>Seeds 7 (test net) and 8 (Lab-shaped net) fix the random numbers, so every visit checks the same two nets.</p>`,
    words: [
      ["Float", "floating point, the computer's usual decimal maths"],
      ["Weight", "the number an input is multiplied by"],
      ["Bias", "a number added to a layer's total before the squash"],
      ["Mask", "a rule that forbids some actions"],
    ],
  },
  net: {
    what: "A small neural net drives a second tank beside the PI's tank. Both tanks get the same setpoint and the same disturbance; each has its own sensor noise. The net first learned by copying the PI, then was tuned by trial and error to lower its error score (the Replay tab shows how). So it behaves much like the PI, but not exactly.",
    tryit: "Tap Net on, then tap Disturbance and compare the two tanks: how deep each dips and how fast each gets back. Then drag the setpoint down to 0.25 m and back up, and watch which level arrives first.",
    deep: `<p><b>What the net sees.</b> Every 0.1 s it gets 4 numbers: the setpoint, the measured level, the error (setpoint minus level), and the error added up over time, divided by 32 to keep it small. The PI uses only the last two. The net gets all four, so later training could teach it to treat a low tank differently from a full one.</p>
      <p><b>Inside.</b> 16 neurons each multiply the 4 inputs by their own weights, add them up with a bias, and squash the total through tanh (see the Tables tab) into −1 to 1. One more neuron does the same with those 16 numbers. Its answer, from −1 to 1, becomes the valve: −1 is shut, 0 is half open, 1 is fully open. That is 97 numbers to learn: 64 + 16 in the first layer, 16 + 1 in the second.</p>
      <p><b>A worked example</b>, the net's sums for its tank right now:</p>
      <div class="now" id="net-now" aria-live="off"></div>
      <p><b>How it learned: copying.</b> <span id="net-train"></span></p>
      <p><b>Then tuning.</b> The copied net was tuned for 50 rounds by evolution strategies, working on its whole numbers directly. The Replay tab explains it and shows whether it paid off.</p>
      <p><b>From decimals to whole numbers.</b> Training uses decimal maths. Afterwards each weight is stored as a whole number multiplied by 16,384 (so 0.5 is stored as 8192) and each bias multiplied by 4,096. The tank runs on those whole numbers only. <span id="net-ivf"></span></p>
      <p><b>The heat map</b> shows all 97 numbers. Each row of the top four is one input: how much it counts for each of the 16 neurons. The fifth row is each neuron's bias. The sixth row is how much each neuron counts towards the valve, and the single square under it is the valve neuron's bias. Purple squares are positive, grey squares negative, and a stronger square is a bigger number. A pattern you can read by eye is rare in nets; here, look for the error and error-so-far rows, the two inputs the PI uses.</p>`,
    words: [
      ["Neuron", "one weighted sum plus a squash"],
      ["Weight", "how much one input counts towards a neuron"],
      ["Bias", "a number a neuron adds before the squash"],
      ["Loss", "the training score: how far the net's valve is from the PI's, squared and averaged. Lower is closer"],
      ["Training step", "one small change to all 97 numbers to lower the loss on 64 situations"],
    ],
  },
};

export const REPLAY_EXPLAIN: Explain = {
  what: "How the net learned, snapshot by snapshot, and whether it beats the PI tuned once on five tests it never practised on. The curve's left half is copying the PI; the right half is tuning. The tank below replays those five tests with the snapshot you pick. The answer can be no: that is a useful result too.",
  tryit: "Drag the snapshot slider from the first snapshot to the last and watch the dot move along the curve. On the first test, 0.75→0.15, compare how fast the level comes down at snapshot 1 and at snapshot 20. Then read the verdict: it never changes with the slider, because it judges the final net.",
  deep: `<p><b>Phase 1, copy.</b> The net learns to give the same valve opening as the PI, in the situations the PI met (the Net tab explains it). The left half of the curve is the loss, on a log scale: how far the net's valve is from the PI's. Lower is closer. 10 snapshots were saved, one every 200 steps.</p>
    <p><b>Phase 2, tuning by evolution strategies (ES).</b> Each round (a generation), Phobos makes 32 slightly changed copies of the net. Every one of the 97 whole numbers is nudged by a random amount, about 32 steps either way. Copies come in mirror pairs: if one adds 25 to a number, its twin takes 25 away. Each copy drives the tank through the five training tests on noise seeds 1 to 5, and gets their total error score (IAE). Then the copies are ranked: the best gets +0.5, the worst −0.5, and the rest are spread evenly between. Each number moves towards the nudges of the better copies and away from those of the worse: step = 128 × (sum of rank × nudge) ÷ 32, rounded to a whole number. Nobody computes a slope; the ranking does the work. 50 generations, a snapshot every 5. The right half of the curve is the net's training error score after each generation; the dashed line is the PI tuned once on the same tests.</p>
    <p><b>A worked example</b>, from the training run itself: one number through generation 1. Here ε is the random nudge before it is multiplied by 32.</p>
    <div class="now" id="es-example" aria-live="off"></div>
    <p><b>Why ranks, not scores.</b> Ranks don't care how much better a copy is, only whether it is better. One copy that happens to crash the tank can't drag the step its way.</p>
    <p><b>Why tune the whole numbers.</b> The copy phase trains in decimals and then rounds. ES scores the whole-number net that actually runs, so nothing is lost in rounding afterwards.</p>
    <p><b>Held-out tests.</b> The verdict uses five other tests (other start levels and setpoints) and noise seeds 101 to 105. The net never trained on them. A net that only memorised its practice would fail here. The tank above replays them on seed 101.</p>
    <p><b>The verdict</b> is yes only if all three hold: a lower total error score than the PI tuned once, no single test more than 5% worse, and valve movement at most twice the PI's. Valve movement includes the twitching caused by sensor noise, because that wears a real valve too.</p>`,
  words: [
    ["Snapshot", "a saved copy of the net partway through training"],
    ["Generation", "one round of trying 32 changed copies and taking one step"],
    ["Antithetic pair", "two copies with opposite nudges, which makes the step less noisy"],
    ["Held-out", "kept back from training, so it can test what was learned"],
  ],
};
EXPLAIN.replay = REPLAY_EXPLAIN;

export function explainHtml(e: Explain): { what: string; after: string } {
  return {
    what: `<div class="what"><small>What you're seeing</small><p>${e.what}</p></div>`,
    after: `<div class="try"><small>Try this</small><p>${e.tryit}</p></div>
      <details class="deep"><summary>How it works</summary><div class="deepin">${e.deep}
      <p class="words"><b>Words used here.</b> ${e.words.map(([w, d]) => `<b>${w}</b>: ${d}.`).join(" ")}</p></div></details>`,
  };
}
