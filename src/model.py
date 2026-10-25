"""Skill gap forecasting, project matching and hire/train/move planning for Accenture."""
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity

from src.utils import bar, holt, kpi, line, num, pct, rec, table

META = json.loads(Path(__file__).with_name("meta.json").read_text())
PARAMS = [
    {"name": "qualified_level", "label": "Proficiency that counts as qualified (1-5)", "min": 2, "max": 5, "step": 1, "default": 3},
    {"name": "training_months", "label": "Months to train a near-ready person", "min": 1, "max": 6, "step": 1, "default": 3},
]
H = 6


def run(data, qualified_level=3, training_months=3):
    P, hist, projects = data["consultants"], data["skill_demand_history"], data["projects"]
    skills = [c for c in hist.columns if c != "month"]
    prof = P[skills].to_numpy(int); primary = prof.argmax(1)
    fc = {s: np.maximum(0, holt(hist[s].to_numpy(), 0.5, 0.3, H)[1]) for s in skills}
    supply = {s: int(((primary == j) & (prof[:, j] >= qualified_level)).sum()) for j, s in enumerate(skills)}
    gap = pd.DataFrame({s: fc[s] - supply[s] * 0.92 for s in skills}, index=[f"M+{i + 1}" for i in range(H)]).T
    pool = {s: int(max(0, -gap.loc[s].max())) for s in skills}
    rows = []
    for j, s in enumerate(skills):
        g = int(np.ceil(max(0, gap.loc[s].max())))
        if g <= 0: continue
        when = int(np.argmax(gap.loc[s].to_numpy() > 0)) + 1
        left, mv = g, 0
        for i in np.where((prof[:, j] >= qualified_level) & (primary != j))[0]:
            if not left: break
            src = skills[primary[i]]
            if pool[src] > 0: pool[src] -= 1; mv += 1; left -= 1
        near = int(((prof[:, j] == qualified_level - 1) & (primary != j)).sum())
        tr = min(left, int(near * 0.6)); left -= tr
        plan = [f"move {mv} from surplus skills"] * bool(mv) + [f"train {tr} near-ready people in {training_months} months" + (f" (contractors until month {training_months + 1})" if when <= training_months else "")] * bool(tr) + [f"hire {left}"] * bool(left)
        lever = "Hire" if left >= max(mv, tr) else "Train" if tr >= mv else "Move"
        rows.append({"skill": s, "peak_gap_fte": g, "opens_month": when, "usable_capacity": round(supply[s] * 0.92, 1), "peak_demand": round(fc[s].max(), 1),
                     "move": mv, "train": tr, "hire": left, "main_lever": lever, "plan": "; ".join(plan).capitalize()})
    dec = pd.DataFrame(rows).sort_values("peak_gap_fte", ascending=False) if rows else pd.DataFrame(columns=["skill", "peak_gap_fte", "opens_month", "usable_capacity", "peak_demand", "move", "train", "hire", "main_lever", "plan"])

    vec = np.where(prof >= qualified_level, prof, 0)
    avail = (P.allocation < 0.5).to_numpy(); used = np.zeros(len(P), bool); staff = []
    for pr in projects.itertuples():
        need = pr.skills_needed.split("|")
        req = np.array([[4 if s in need else 0 for s in skills]])
        cand = np.where(avail & ~used & (P.rolls_off_month.to_numpy() <= pr.start_month))[0]
        sims = cosine_similarity(vec[cand], req)[:, 0] if len(cand) else np.array([])
        order = cand[np.argsort(-sims)][: pr.team_size] if len(cand) else []
        got = [i for i, sv in zip(order, np.sort(sims)[::-1]) if sv > 0.3]
        used[got] = True
        fit = float(np.mean(cosine_similarity(vec[got], req))) if got else 0.0
        fill = len(got) / pr.team_size
        staff.append({"project": pr.name, "start_month": pr.start_month, "skills_needed": ", ".join(need), "needed": pr.team_size, "matched": len(got),
                      "fit": round(fit, 2), "status": "Staffed" if fill >= 1 else "Nearly" if fill >= 0.75 else "At risk"})
    staff = pd.DataFrame(staff); at_risk = staff[staff.status == "At risk"]
    top3 = dec.skill.head(3).tolist()
    trend = pd.DataFrame({"month": list(hist.month) + [f"M+{i + 1}" for i in range(H)]})
    for s in top3: trend[s] = list(hist[s]) + list(fc[s].round(2))
    heat = gap.round(0).reset_index().rename(columns={"index": "skill"})
    hires, trains, moves = int(dec.hire.sum()), int(dec.train.sum()), int(dec.move.sum())
    return {
        "steps": [f"{len(P)} consultants, {len(projects)} projects in pipeline", f"{len(skills)} standard skills",
                  f"{len(P)} x {len(skills)} matrix, {int((prof >= qualified_level).sum())} qualified skill entries",
                  f"Fastest growing: {max(skills, key=lambda s: fc[s][-1] / hist[s].iloc[-1])}",
                  f"{len(dec)} skills short at peak" + (f", largest {dec.iloc[0].skill} ({dec.iloc[0].peak_gap_fte} FTE)" if len(dec) else ""),
                  f"Average project fill {pct((staff.matched / staff.needed).mean(), 0)}", f"Hire {hires} | Train {trains} | Move {moves}", "Ready"],
        "kpis": [kpi("Headcount", num(len(P)), f"{int((P.allocation < 0.3).sum())} on the bench"), kpi("Skills short", f"{len(dec)} of {len(skills)}", "Within 6 months"),
                 kpi("Peak FTE gap", num(dec.peak_gap_fte.sum()), "Across short skills"), kpi("Projects at risk", str(len(at_risk)), "Under 75% staffed"),
                 kpi("Plan", f"{hires} / {trains} / {moves}", "Hire / train / move")],
        "charts": [line("Demand trend for the top gaps", trend, "month", top3, "24 months of history then a 6-month Holt forecast.") if top3 else line("Demand trend", trend.assign(total=0), "month", "total"),
                   bar("Capacity vs peak demand", dec.head(7) if len(dec) else pd.DataFrame({"skill": ["none"], "usable_capacity": [0], "peak_demand": [0]}), "skill", ["usable_capacity", "peak_demand"])],
        "tables": [table("Skill gap by month (FTE)", heat, "Forecast demand minus usable capacity. Negative means spare capacity."), table("Hire, train or move", dec),
                   table("Project staffing from available people", staff)],
        "recs": [rec(f"Close the {r.skill} gap of {r.peak_gap_fte} FTE", f"Opens in month {r.opens_month}. {r.plan}.", " | ".join(x for x in [f"{r.move} move" * bool(r.move), f"{r.train} train" * bool(r.train), f"{r.hire} hire" * bool(r.hire)] if x)) for r in dec.head(5).itertuples()]
                + ([rec(f"Rescue {len(at_risk)} under-staffed projects", f"{', '.join(at_risk.project.head(3))} cannot be fully staffed from the bench. Bring in contractors or shift start dates.", "Deadline risk")] if len(at_risk) else [])
                + [rec("Review the skills taxonomy every quarter", "Demand for GenAI and data skills moves fastest; refresh the forecast with each pipeline review.", "Process")],
    }


if __name__ == "__main__":
    from src.data_generator import load_or_generate
    from src.report import write_reports

    out = run(load_or_generate(), **{p["name"]: p["default"] for p in PARAMS})
    for k in out["kpis"]:
        print(f"{k['label']}: {k['value']}  {k['note']}")
    print("Reports written to", write_reports(out, META, Path(__file__).resolve().parent.parent / "reports"))
