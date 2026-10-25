/* Accenture Skills Navigator: sample data generator and algorithm for Accenture. */
const TOOL = {
  num: 6, area: "HR", product: "Workforce Capacity & Skill Gap", seed: 66,
  title: "Accenture Skills Navigator", company: "Accenture",
  why: "Accenture staffs hundreds of thousands of people on client projects. Headcount can look fine while the specific skills a project needs next month are booked elsewhere. This tool maps skills to demand and decides hire, train or move.",
  statement: "A company has sufficient employees on paper but continues to miss project deadlines because the required skills are not available at the right time. Develop an AI workforce intelligence system that maps employee skills against business requirements, identifies critical skill gaps, and recommends hiring, training and internal allocation strategies.",
  dataNote: "One delivery centre: 420 consultants, 14 skills, 24 months of demand history and 12 upcoming projects (sample data).",
  steps: [
    ["Collect skills and pipeline", "Profiles, certifications, allocation, project pipeline"],
    ["Standardise skills", "Map free-text CV skills to one taxonomy"],
    ["Build skill matrix", "Proficiency 0-5 per person per skill"],
    ["Forecast demand", "Holt trend forecast per skill, 6 months ahead"],
    ["Find gaps", "Forecast demand vs available qualified people by month"],
    ["Match people to projects", "Cosine similarity on skill vectors + greedy assignment"],
    ["Hire, train or move", "Rule engine on gap size, lead time and near-ready staff"],
    ["Staffing plan", "AI analyst writes the plan"]
  ],
  params: [
    { id: "prof", label: "Proficiency that counts as qualified", min: 2, max: 5, step: 1, value: 3, fmt: v => v + " / 5" },
    { id: "train", label: "Months to train a near-ready person", min: 1, max: 6, step: 1, value: 3, fmt: v => v + " mo" }
  ],
  questions: ["Which skill gap will hurt delivery first?", "Should we hire or train for GenAI engineering?", "Which projects are at risk of missing deadlines?", "Who on the bench can be moved right now?"],
  generate(r) {
    const skills = ["Java", "Python", "SAP S/4HANA", "Salesforce", "AWS Cloud", "Azure Cloud", "Data Engineering", "GenAI Engineering", "Cybersecurity", "React Frontend", "DevOps", "Power BI", "Agile Delivery", "ServiceNow"];
    const pop = [0.30, 0.22, 0.12, 0.12, 0.16, 0.14, 0.12, 0.04, 0.06, 0.18, 0.12, 0.14, 0.2, 0.06];
    const trend = [-0.15, 0.25, 0.1, 0.05, 0.2, 0.3, 0.45, 1.4, 0.4, 0.0, 0.2, 0.1, 0.0, 0.15];
    const people = S.range(420).map(i => { const prof = skills.map((_, j) => r.chance(pop[j]) ? r.int(2, 5) : r.chance(0.15) ? r.int(1, 2) : 0); const alloc = r.chance(0.82) ? r.u(0.6, 1) : r.u(0, 0.3); return { id: "C" + (3000 + i), level: r.wpick(["Analyst", "Consultant", "Manager"], [5, 3, 1.2]), prof, alloc, roll: r.int(1, 8) }; });
    const prim = p => p.prof.indexOf(Math.max(...p.prof));
    const hist = skills.map((_, j) => { const sup = Math.max(3, people.filter(p => prim(p) === j && p.prof[j] >= 3).length), f = j === 6 ? 1.12 : j === 8 ? 1.3 : r.u(0.9, 1.03), b = j === 7 ? 9 : sup * 0.92 / (1 + trend[j]) * f; return S.range(24).map(t => Math.max(1, b * (1 + trend[j] * t / 24) + r.n(0, b * 0.025))); });
    const clients = ["Retail bank", "Insurer", "Telecom", "Pharma", "Automaker", "Utility", "Airline", "Retailer", "Govt agency", "Media group", "Logistics co.", "FMCG"];
    const projects = clients.map((c, i) => { const need = S.range(r.int(2, 4)).map(() => r.int(0, 13)); return { id: "P" + (i + 1), name: `${c} ${r.pick(["cloud migration", "data platform", "CRM rollout", "GenAI pilot", "ERP upgrade", "app rebuild"])}`, start: r.int(1, 6), size: r.int(4, 12), need: [...new Set(need.concat(r.chance(0.5) ? [7] : []))] }; });
    return { skills, people, hist, projects };
  },
  analyze(D, P, r) {
    const { skills, people, hist, projects } = D, k = skills.length, H = 6;
    const fc = hist.map(h => M.holt(h, 0.5, 0.3, H).fc.map(v => Math.max(0, v)));
    const prim = p => p.prof.indexOf(Math.max(...p.prof));
    const qualified = j => people.filter(p => p.prof[j] >= P.prof);
    const supply = skills.map((_, j) => people.filter(p => prim(p) === j && p.prof[j] >= P.prof).length);
    const supM = skills.map((_, j) => S.range(H).map(() => supply[j] * 0.92)); // 92% max utilisation
    const gap = skills.map((_, j) => fc[j].map((d, mo) => d - supM[j][mo]));
    const peak = gap.map(g => Math.max(...g)); const firstMo = gap.map(g => g.findIndex(v => v > 0));
    const pool = skills.map((_, j) => Math.floor(Math.max(0, -Math.max(...gap[j]))));
    // decisions: move people from surplus skills first, then train near-ready staff, then hire
    const dec = skills.map((s, j) => {
      const g = Math.ceil(Math.max(0, peak[j])); if (g <= 0) return { s, j, g, act: "Covered", n: 0, mv: 0, tr: 0, hi: 0 };
      const when = firstMo[j] + 1; let left = g, mv = 0;
      const movers = people.filter(p => p.prof[j] >= P.prof && prim(p) !== j && pool[prim(p)] > 0);
      for (const p of movers) { if (!left) break; pool[prim(p)]--; mv++; left--; }
      const nr = people.filter(p => p.prof[j] === P.prof - 1 && prim(p) !== j).length;
      const tr = Math.min(left, Math.floor(nr * 0.6)); left -= tr;
      const parts = []; if (mv) parts.push(`move ${mv} from surplus skills`); if (tr) parts.push(`train ${tr} near-ready people in ${P.train} months${when <= P.train ? ` (cover with contractors until month ${P.train + 1})` : ""}`); if (left) parts.push(`hire ${left} because the near-ready pool is too small`);
      const act = left >= Math.max(mv, tr) ? "Hire" : tr >= mv ? "Train" : "Reallocate";
      return { s, j, g, act, n: g, mv, tr, hi: left, when, why: parts.join(", ").replace(/^./, c => c.toUpperCase()) };
    });
    const freeNow = skills.map((_, j) => S.sum(qualified(j).map(p => 1 - p.alloc)));
    // matching
    const vec = p => p.prof.map(v => v >= P.prof ? v : 0); const cos = (a, b) => { const d = S.sum(a.map((v, i) => v * b[i])), na = Math.sqrt(S.sum(a.map(v => v * v))), nb = Math.sqrt(S.sum(b.map(v => v * v))); return na && nb ? d / (na * nb) : 0; };
    const avail = people.filter(p => p.alloc < 0.5).map(p => ({ ...p, used: false }));
    const assign = projects.map(pr => { const req = skills.map((_, j) => pr.need.includes(j) ? 4 : 0); const cands = avail.filter(p => !p.used && p.roll <= pr.start).map(p => ({ p, s: cos(vec(p), req) })).filter(c => c.s > 0.3).sort((a, b) => b.s - a.s); const got = cands.slice(0, pr.size); got.forEach(c => c.p.used = true); return { pr, got, fill: got.length / pr.size, fit: S.mean(got.map(c => c.s)) || 0 }; });
    const hires = S.sum(dec.map(d => d.hi)), trains = S.sum(dec.map(d => d.tr)), moves = S.sum(dec.map(d => d.mv));
    const crit = [...dec].filter(d => d.g > 0).sort((a, b) => b.g - a.g);
    const atRisk = assign.filter(a => a.fill < 0.75);
    const months = S.range(H).map(i => "M+" + (i + 1));
    const tone = a => a === "Hire" ? "bad" : a === "Train" ? "warn" : a === "Reallocate" ? "good" : "mut";
    return {
      steps: [`${people.length} consultants, ${projects.length} projects in pipeline`, `${k} standard skills`, `${people.length} × ${k} matrix, ${F.num(S.sum(people.map(p => p.prof.filter(v => v >= P.prof).length)))} qualified skill entries`, `Fastest growing: ${skills[fc.map((f, j) => f[H - 1] / hist[j][23]).indexOf(Math.max(...fc.map((f, j) => f[H - 1] / hist[j][23])))]}`, `${crit.length} skills short at peak, largest ${crit[0]?.s} (${crit[0]?.g} FTE)`, `Avg project fill ${F.pct(S.mean(assign.map(a => a.fill)), 0)}`, `Hire ${hires} · Train ${trains} · Move ${moves}`, "Ready"],
      kpis: [
        { label: "Headcount", value: F.num(people.length), note: `${F.num(people.filter(p => p.alloc < 0.3).length)} on the bench` },
        { label: "Skills short", value: `${crit.length} of ${k}`, note: "Within 6 months", tone: crit.length ? "bad" : "good" },
        { label: "Peak FTE gap", value: F.num(S.sum(dec.map(d => d.g))), note: "Across short skills", tone: "warn" },
        { label: "Projects at risk", value: String(atRisk.length), note: "Under 75% staffed at start", tone: atRisk.length ? "bad" : "good" },
        { label: "Plan", value: `${hires} / ${trains} / ${moves}`, note: "Hire / train / move" }
      ],
      sections: [
        { title: "Skill gap by month", note: "Forecast demand minus usable capacity of people whose main skill it is (FTE). Darker red means a bigger shortage; negative numbers are spare capacity.", chart: C.heat(skills, months, gap.map(g => g.map(v => Math.round(v))), { fmt: v => (v > 0 ? "+" : "") + v, color: "var(--bad)", rowW: 140, cell: 70, lo: 0, hi: Math.max(1, ...gap.flat()) }) },
        { pair: [
          { title: "Demand trend: top 3 gaps", note: "24 months of history, then the 6-month forecast (dashed).", chart: (() => { const top = crit.slice(0, 3); const xl = S.range(30).map(i => i < 24 ? (i % 6 === 0 ? "M" + (i - 23) : "") : "M+" + (i - 23)); return C.line(xl, top.map((d, i) => ({ values: hist[d.j].concat(new Array(H).fill(null)), tone: "c" + (i + 1) })).concat(top.map((d, i) => ({ values: new Array(23).fill(null).concat([hist[d.j][23]], fc[d.j]), tone: "c" + (i + 1), dash: "4 3", end: true }))), { fmt: v => F.num(v), every: 6 }) + C.legend(top.map((d, i) => ({ label: d.s, tone: "c" + (i + 1) }))); })() },
          { title: "Capacity vs peak demand", chart: C.grouped(crit.slice(0, 7).map(d => d.s), [{ name: "Qualified", values: crit.slice(0, 7).map(d => supply[d.j] * 0.92), tone: "c2" }, { name: "Peak demand", values: crit.slice(0, 7).map(d => Math.max(...fc[d.j])), tone: "c3" }], { fmt: v => F.num(v), labelW: 140 }) + C.legend([{ label: "Usable capacity (FTE)", tone: "c2" }, { label: "Peak forecast demand (FTE)", tone: "c3" }]) }
        ] },
        { title: "Hire, train or move", html: T.table(["Skill", "Peak gap", "Opens", "Main lever", "Move", "Train", "Hire", "Plan"], crit.map(d => [d.s, d.g, "Month " + d.when, T.pill(d.act, tone(d.act)), d.mv, d.tr, d.hi, d.why]), { right: [1, 4, 5, 6] }) },
        { title: "Project staffing from available people", note: "Consultants under 50% allocated and free before project start, matched by skill similarity.", html: T.table(["Project", "Starts", "Skills needed", "Needed", "Matched", "Fit", "Status"], assign.map(a => [a.pr.name, "Month " + a.pr.start, a.pr.need.map(j => skills[j]).join(", "), a.pr.size, a.got.length, a.fit.toFixed(2), T.pill(a.fill >= 1 ? "Staffed" : a.fill >= 0.75 ? "Nearly" : "At risk", a.fill >= 1 ? "good" : a.fill >= 0.75 ? "warn" : "bad")]), { right: [3, 4, 5] }) }
      ],
      recs: crit.slice(0, 5).map(d => ({ title: `Close the ${d.s} gap of ${d.g} FTE`, body: `Opens in month ${d.when}. ${d.why}.`, impact: [d.mv && `${d.mv} move`, d.tr && `${d.tr} train`, d.hi && `${d.hi} hire`].filter(Boolean).join(" · "), tone: tone(d.act) })).concat(atRisk.length ? [{ title: `Rescue ${atRisk.length} under-staffed projects`, body: `${atRisk.map(a => a.pr.name).slice(0, 3).join(", ")}${atRisk.length > 3 ? " and others" : ""} cannot be fully staffed from the bench. Bring in contractors or shift start dates.`, impact: "Deadline risk", tone: "bad" }] : []),
      context: { qualified_level: P.prof, training_months: P.train, gaps: crit.map(d => ({ skill: d.s, peak_gap_fte: d.g, opens_month: d.when, move: d.mv, train: d.tr, hire: d.hi, plan: d.why, qualified_people: supply[d.j], forecast_peak: Math.round(Math.max(...fc[d.j])) })), projects: assign.map(a => ({ project: a.pr.name, start_month: a.pr.start, skills: a.pr.need.map(j => skills[j]), needed: a.pr.size, matched: a.got.length, fit: +a.fit.toFixed(2) })), bench: people.filter(p => p.alloc < 0.3).length }
    };
  }
};
