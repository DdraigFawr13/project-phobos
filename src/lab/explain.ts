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
      <p><b>Why one tuning isn't right everywhere.</b> Water leaves at k × √level (k = 0.05). A fuller tank drains faster, so the tank reacts differently at 0.25 m than at 1.75 m. The tuning rule used here gives Ti = 40 × √level seconds: 20 s at 0.25 m, 40 s at 1.0 m, about 53 s at 1.75 m. This PI uses 40 s everywhere. The Fixed test tab, coming next, measures what that costs, and Phobos asks whether a small neural net can do better.</p>
      <p><b>The tank.</b> Floor area 1 m², 2 m tall. Full valve lets in 0.1 m³/s, so holding 1.0 m needs the valve half open. The level sensor adds up to ±5 mm of noise; the PI reacts to it, so the valve twitches slightly all the time. The simulation runs 10 times faster than real time.</p>`,
    words: [
      ["Setpoint", "the level you ask for"],
      ["PI", "a controller with a proportional (P) and an integral (I) part. Many controllers add a third, derivative (D) part; this one doesn't"],
      ["Kp", "the gain: how hard P pushes per metre of error"],
      ["Disturbance", "something outside the controller that upsets the tank"],
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
