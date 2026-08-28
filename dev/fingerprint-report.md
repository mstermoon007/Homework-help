# Plugin Duplicate-Rate Fingerprint Report

Generated: 2026-08-28T01:57:14.422Z

| Metric | Value |
| --- | --- |
| Math plugins analyzed | 82 |
| Over question-dup threshold | 27 |
| Code-level dup groups (L1/L3) | 0 |
| Fix categories | {"weak-variation":10,"no-generate":17,"ok":55} |

## Over-threshold plugins (require fix)

| Plugin | Q-Dup% | Threshold% | Pool | Category |
| --- | --- | --- | --- | --- |
| math-clock | 88 | 60 | - | weak-variation |
| math-geometry | 83 | 60 | - | weak-variation |
| math-logic-reasoning | 82 | 50 | - | weak-variation |
| math-word-problems | 80 | 60 | - | weak-variation |
| math-picture-equations | 76 | 60 | - | weak-variation |
| math-combination-set | 74 | 35 | - | weak-variation |
| math-fraction | 73 | 35 | - | no-generate |
| math-unit-convert | 69 | 60 | - | weak-variation |
| math-patterns | 63 | 60 | - | no-generate |
| math-competition-g6-c7 | 63 | 15 | - | no-generate |
| math-money | 62 | 60 | - | weak-variation |
| math-g6-reasoning | 59 | 50 | - | no-generate |
| math-area | 55 | 35 | - | no-generate |
| math-g5-match | 50 | 15 | - | no-generate |
| math-time-date | 48 | 35 | - | weak-variation |
| math-position-direction | 48 | 35 | - | weak-variation |
| math-g6-calc | 41 | 15 | - | no-generate |
| math-g6-stats | 39 | 15 | - | no-generate |
| math-g5-draw | 32 | 15 | - | no-generate |
| math-g5-reason | 28 | 15 | - | no-generate |
| math-g6-picture-equation | 26 | 15 | - | no-generate |
| math-competition-g5-c3 | 23 | 15 | - | no-generate |
| math-g6-fill | 23 | 15 | - | no-generate |
| math-g5-picture | 22 | 15 | - | no-generate |
| math-g5-choice | 22 | 15 | - | no-generate |
| math-competition-g5-c7 | 17 | 15 | - | no-generate |
| math-competition-g6-c6 | 17 | 15 | - | no-generate |

## All plugins (sorted by question-dup rate)

| Plugin | Q-Dup% | Code-Dup% | With | Category |
| --- | --- | --- | --- | --- |
| math-clock | 88 | 22 | math-position-direction | weak-variation |
| math-geometry | 83 | 16 | math-unit-convert | weak-variation |
| math-logic-reasoning | 82 | 23 | math-combination-set | weak-variation |
| math-word-problems | 80 | 3 | math-picture-equations | weak-variation |
| math-picture-equations | 76 | 18 | math-patterns | weak-variation |
| math-combination-set | 74 | 25 | math-position-direction | weak-variation |
| math-fraction | 73 | 21 | math-decimal | no-generate |
| math-unit-convert | 69 | 23 | math-money | weak-variation |
| math-patterns | 63 | 18 | math-picture-equations | no-generate |
| math-competition-g6-c7 | 63 | 19 | math-competition-g5-c6 | no-generate |
| math-money | 62 | 23 | math-unit-convert | weak-variation |
| math-g6-reasoning | 59 | 29 | math-g6-stats | no-generate |
| math-number-sense | 55 | 16 | math-unit-convert | ok |
| math-area | 55 | 4 | math-logic-reasoning | no-generate |
| math-shapes | 54 | 17 | math-unit-convert | ok |
| math-statistics | 52 | 22 | math-logic-reasoning | ok |
| math-g4-judge | 50 | 44 | math-g5-judge | ok |
| math-g5-match | 50 | 33 | math-g5-judge | no-generate |
| math-time-date | 48 | 22 | math-combination-set | weak-variation |
| math-position-direction | 48 | 25 | math-combination-set | weak-variation |
| math-g5-judge | 45 | 44 | math-g4-judge | ok |
| math-g6-calc | 41 | 22 | math-g5-vertical | no-generate |
| math-g6-stats | 39 | 31 | math-g6-picture-equation | no-generate |
| math-decimal | 35 | 21 | math-fraction | ok |
| math-g4-match | 35 | 28 | math-g5-match | ok |
| math-g5-draw | 32 | 16 | math-g4-judge | no-generate |
| math-g4-draw | 29 | 17 | math-g4-reason | ok |
| math-g5-reason | 28 | 32 | math-g5-match | no-generate |
| math-data-stats | 27 | 20 | math-unit-convert | ok |
| math-g4-reason | 27 | 21 | math-g5-stats | ok |
| math-g6-picture-equation | 26 | 31 | math-g6-stats | no-generate |
| math-g1-multiplication-table | 24 | 12 | _template | ok |
| math-make-ten | 23 | 15 | math-logic-reasoning | ok |
| math-competition-g5-c3 | 23 | 15 | math-competition-g5-c5 | no-generate |
| math-g6-fill | 23 | 21 | math-g5-reason | no-generate |
| math-g5-picture | 22 | 19 | math-g6-reasoning | no-generate |
| math-g5-choice | 22 | 27 | math-g5-judge | no-generate |
| math-competition-g5-c7 | 17 | 15 | math-competition-g5-c5 | no-generate |
| math-competition-g6-c6 | 17 | 17 | math-competition-g5-c6 | no-generate |
| math-competition-c3-counting | 15 | 24 | math-competition-c2-numbertheory | ok |
| math-competition-c8-logic | 14 | 12 | math-competition-g6-c7 | ok |
| math-competition-g4-c9 | 14 | 15 | math-competition-g6-c7 | ok |
| math-g4-choice | 14 | 20 | math-g4-match | ok |
| math-competition-g5-c6 | 13 | 19 | math-competition-g6-c7 | ok |
| math-competition-g6-c4 | 12 | 14 | math-competition-g6-c7 | ok |
| math-oral | 11 | 2 | _template | ok |
| math-competition-g5-c2 | 11 | 14 | math-competition-g5-c3 | ok |
| math-g4-word | 11 | 17 | math-g4-judge | ok |
| math-g5-fill | 11 | 16 | math-g5-reason | ok |
| math-competition-g5-c4 | 10 | 9 | math-competition-g5-c7 | ok |
| math-competition-g5-c8 | 10 | 11 | math-competition-g6-c8 | ok |
| math-competition-g6-c8 | 10 | 14 | math-competition-g6-c6 | ok |
| math-g4-fill | 10 | 19 | math-g4-match | ok |
| math-g6-word-problems | 10 | 18 | math-g5-reason | ok |
| math-g6-oral | 9 | 19 | math-g5-match | ok |
| math-g5-vertical | 7 | 25 | math-g4-vertical | ok |
| math-competition-c4-geometry | 6 | 15 | math-competition-c5-journey | ok |
| math-competition-g6-c3 | 6 | 10 | math-competition-g5-c3 | ok |
| math-g4-mixed | 6 | 22 | math-g5-match | ok |
| math-g5-oral | 5 | 22 | math-g5-match | ok |
| math-competition-g5-c5 | 4 | 18 | math-competition-g6-c7 | ok |
| math-competition-g6-c2 | 4 | 8 | math-competition-g6-c6 | ok |
| math-competition-c2-numbertheory | 3 | 24 | math-competition-c3-counting | ok |
| math-competition-g5-c9 | 3 | 9 | math-competition-g5-c7 | ok |
| math-competition-g6-c1 | 3 | 9 | math-competition-g5-c1 | ok |
| math-competition-g6-c5 | 3 | 8 | math-competition-g5-c6 | ok |
| math-g5-stats | 3 | 26 | math-g6-stats | ok |
| math-competition-c1-numberpuzzle | 1 | 16 | math-competition-c2-numbertheory | ok |
| math-competition-g6-c9 | 1 | 15 | math-competition-g6-c7 | ok |
| math-g4-oral | 1 | 21 | math-g5-oral | ok |
| math-g4-vertical | 1 | 25 | math-g5-vertical | ok |
| math-g4-picture | 1 | 18 | math-g6-reasoning | ok |
| math-g5-mixed | 1 | 20 | math-g5-reason | ok |
| math-g5-word | 1 | 18 | math-g5-reason | ok |
| math-comprehensive | 0 | 7 | math-logic-reasoning | ok |
| math-competition-c5-journey | 0 | 15 | math-competition-c4-geometry | ok |
| math-competition-g5-c1 | 0 | 9 | math-competition-g6-c1 | ok |
| math-g4-stats | 0 | 20 | math-g5-stats | ok |
| math-g6-matching | 0 | 22 | math-g6-judge | ok |
| math-g6-operation | 0 | 17 | math-g6-judge | ok |
| math-g6-judge | 0 | 25 | math-g6-choice | ok |
| math-g6-choice | 0 | 25 | math-g6-judge | ok |
