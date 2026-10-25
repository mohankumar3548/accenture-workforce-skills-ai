"""Sample data for Accenture: 420 consultants, 14 skills, 24 months of demand and 12 upcoming projects."""
from pathlib import Path

import numpy as np
import pandas as pd

SKILLS = ["Java", "Python", "SAP S/4HANA", "Salesforce", "AWS Cloud", "Azure Cloud", "Data Engineering", "GenAI Engineering",
          "Cybersecurity", "React Frontend", "DevOps", "Power BI", "Agile Delivery", "ServiceNow"]
POP = [0.30, 0.22, 0.12, 0.12, 0.16, 0.14, 0.12, 0.04, 0.06, 0.18, 0.12, 0.14, 0.20, 0.06]
TREND = [-0.15, 0.25, 0.10, 0.05, 0.20, 0.30, 0.45, 1.40, 0.40, 0.0, 0.20, 0.10, 0.0, 0.15]
CLIENTS = ["Retail bank", "Insurer", "Telecom", "Pharma", "Automaker", "Utility", "Airline", "Retailer", "Govt agency", "Media group", "Logistics co.", "FMCG"]
WORK = ["cloud migration", "data platform", "CRM rollout", "GenAI pilot", "ERP upgrade", "app rebuild"]


def generate(seed: int = 42) -> dict:
    rng = np.random.default_rng(seed)
    prof = np.zeros((420, len(SKILLS)), int)
    for j, p in enumerate(POP):
        has = rng.random(420) < p
        prof[has, j] = rng.integers(2, 6, has.sum())
        low = (~has) & (rng.random(420) < 0.15)
        prof[low, j] = rng.integers(1, 3, low.sum())
    people = pd.DataFrame(prof, columns=SKILLS)
    people.insert(0, "consultant_id", [f"C{3000 + i}" for i in range(420)])
    people.insert(1, "level", rng.choice(["Analyst", "Consultant", "Manager"], 420, p=np.array([5, 3, 1.2]) / 9.2))
    people.insert(2, "allocation", np.where(rng.random(420) < 0.82, rng.uniform(0.6, 1, 420), rng.uniform(0, 0.3, 420)).round(2))
    people.insert(3, "rolls_off_month", rng.integers(1, 9, 420))
    primary = prof.argmax(1)
    hist = {"month": [f"M-{23 - t}" for t in range(24)]}
    for j, s in enumerate(SKILLS):
        sup = max(3, int(((primary == j) & (prof[:, j] >= 3)).sum()))
        f = 1.12 if j == 6 else 1.3 if j == 8 else rng.uniform(0.9, 1.03)
        b = 9 if j == 7 else sup * 0.92 / (1 + TREND[j]) * f
        hist[s] = [round(max(1, b * (1 + TREND[j] * t / 24) + rng.normal(0, b * 0.025)), 2) for t in range(24)]
    projects = []
    for i, c in enumerate(CLIENTS):
        need = set(rng.integers(0, 14, rng.integers(2, 5)).tolist())
        if rng.random() < 0.5: need.add(7)
        projects.append({"project_id": f"P{i + 1}", "name": f"{c} {rng.choice(WORK)}", "start_month": int(rng.integers(1, 7)),
                         "team_size": int(rng.integers(4, 13)), "skills_needed": "|".join(SKILLS[k] for k in sorted(need))})
    return {"consultants": people, "skill_demand_history": pd.DataFrame(hist), "projects": pd.DataFrame(projects)}


# ---------------------------------------------------------------------------
# Save and load helpers
# ---------------------------------------------------------------------------
DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def save(data: dict, folder: Path = DATA_DIR) -> None:
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    for name, df in data.items():
        df.to_csv(folder / f"{name}.csv", index=False)


def load_or_generate(folder: Path = DATA_DIR, seed: int = 42) -> dict:
    """Read the CSVs in data/ if they exist, otherwise generate fresh sample data."""
    folder = Path(folder)
    names = list(generate(seed).keys())
    if all((folder / f"{n}.csv").exists() for n in names):
        return {n: pd.read_csv(folder / f"{n}.csv") for n in names}
    return generate(seed)


if __name__ == "__main__":
    d = generate(42)
    save(d)
    for n, df in d.items():
        print(f"data/{n}.csv  {len(df):,} rows x {df.shape[1]} columns")
