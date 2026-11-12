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
};

export function explainHtml(e: Explain): { what: string; after: string } {
  return {
    what: `<div class="what"><small>What you're seeing</small><p>${e.what}</p></div>`,
    after: `<div class="try"><small>Try this</small><p>${e.tryit}</p></div>
      <details class="deep"><summary>How it works</summary><div class="deepin">${e.deep}
      <p class="words"><b>Words used here.</b> ${e.words.map(([w, d]) => `<b>${w}</b>: ${d}.`).join(" ")}</p></div></details>`,
  };
}
