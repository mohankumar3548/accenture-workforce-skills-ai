# Accenture Skills Navigator

AI solution 06 of 14 · HR · built for **Accenture**

Prepared by **K Mohan Kumar**.

**Live website:** https://mohankumar3548.github.io/accenture-workforce-skills-ai/

## Problem statement

A company has sufficient employees on paper but continues to miss project deadlines because the required skills are not available at the right time. Develop an AI workforce intelligence system that maps employee skills against business requirements, identifies critical skill gaps, and recommends hiring, training and internal allocation strategies.

## Why Accenture

Accenture staffs hundreds of thousands of people on client projects. Headcount can look fine while the specific skills a project needs next month are booked elsewhere. This tool maps skills to demand and decides hire, train or move.

## Project structure

```
accenture-workforce-skills-ai/
├── index.html                 Website entry point (served by GitHub Pages)
├── frontend/
│   ├── css/style.css          Layout, typography, light and dark themes
│   └── js/
│       ├── engine.js          Maths, models, charts, page layout and AI analyst panel
│       └── model.js           Sample data and the algorithm for this problem (browser version)
├── app.py                     Streamlit dashboard (Python version of the website)
├── src/
│   ├── data_generator.py      Builds the sample dataset and saves it to data/
│   ├── model.py               The algorithm in Python (pandas, NumPy, scikit-learn)
│   ├── report.py              Writes results to reports/
│   ├── utils.py               Formatting and forecasting helpers
│   └── meta.json              Problem statement, company and algorithm steps
├── data/                      Sample data as CSV
├── reports/                   Results: results.json, summary.md and CSV tables
├── tests/test_model.py        pytest tests for the data and the model
├── requirements.txt
└── pytest.ini
```

## Algorithm

1. **Collect skills and pipeline**: Profiles, certifications, allocation, project pipeline
2. **Standardise skills**: Map free-text CV skills to one taxonomy
3. **Build skill matrix**: Proficiency 0-5 per person per skill
4. **Forecast demand**: Holt trend forecast per skill, 6 months ahead
5. **Find gaps**: Forecast demand vs available qualified people by month
6. **Match people to projects**: Cosine similarity on skill vectors + greedy assignment
7. **Hire, train or move**: Rule engine on gap size, lead time and near-ready staff
8. **Staffing plan**: AI analyst writes the plan

The same algorithm is implemented twice: in JavaScript (`frontend/js/model.js`) so the website runs in any browser with no server, and in Python (`src/model.py`) for analysis, the Streamlit dashboard and the tests.

## How to run

**Website:** open the live link above, or open `index.html` in a browser.

**Python:**

```bash
pip install -r requirements.txt
python -m src.data_generator     # create the sample data in data/
python -m src.model              # run the algorithm and write reports/
streamlit run app.py             # open the interactive dashboard
pytest                           # run the tests
```

## Data

One delivery centre: 420 consultants, 14 skills, 24 months of demand history and 12 upcoming projects (sample data). Files: `data/consultants.csv`, `data/projects.csv`, `data/skill_demand_history.csv`. All figures are illustrative and are not Accenture's actual numbers.

## Results (default settings, Python run)

| Measure | Value | Note |
|---|---|---|
| Headcount | 420 | 72 on the bench |
| Skills short | 8 of 14 | Within 6 months |
| Peak FTE gap | 33 | Across short skills |
| Projects at risk | 10 | Under 75% staffed |
| Plan | 5 / 24 / 4 | Hire / train / move |

### Recommended actions

1. **Close the GenAI Engineering gap of 20 FTE.** Opens in month 1. Train 15 near-ready people in 3 months (contractors until month 4); hire 5.
2. **Close the Cybersecurity gap of 4 FTE.** Opens in month 1. Train 4 near-ready people in 3 months (contractors until month 4).
3. **Close the Data Engineering gap of 3 FTE.** Opens in month 1. Move 1 from surplus skills; train 2 near-ready people in 3 months (contractors until month 4).
4. **Close the DevOps gap of 2 FTE.** Opens in month 1. Train 2 near-ready people in 3 months (contractors until month 4).
5. **Close the Salesforce gap of 1 FTE.** Opens in month 5. Move 1 from surplus skills.

Full output: [`reports/summary.md`](reports/summary.md) and [`reports/results.json`](reports/results.json).

## AI analyst panel

The website includes an "Ask the AI analyst" panel that answers questions about the results through Claude. It works when the page is opened as a Claude artifact on claude.ai. On GitHub Pages the models, charts and controls run in full and the panel shows that it is unavailable.
