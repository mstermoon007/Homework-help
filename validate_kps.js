var KB = require("./shared/knowledge-bank.js");
var allKPs = new Set();
["math", "chinese", "english"].forEach(function(subj) {
  [1,2,3,4,5,6].forEach(function(g) { (KB.getEntries(subj, g) || []).forEach(function(e) { allKPs.add(e.id); }); });
});

var natKPs = [
  "math-g1-m1-addsub-5", "math-g1-m1-addsub-10", "math-g1-m1-addsub-100", "math-g1-m1-addsub-1000",
  "math-g1-m1-carry-add-20", "math-g1-m1-retreat-sub-20", "math-g1-m1-two-digit-add",
  "math-g2-m1-addsub-1000", "math-g2-m3-chain-addsub",
  "math-g1-m13-multiplication-table", "math-g2-m1-mult-table", "math-g2-m1-mixed-multdiv",
  "math-g2-m2-mult-col", "math-g2-m4-multiplication-meaning", "math-g2-m7-pic-mult",
  "math-g2-m8-mult-total", "math-g2-m5-match-multdiv", "math-g3-m1-g3-mul-multi1",
  "math-g6-c1-vertical-multidigit", "math-g6-c3-multiplication-principle",
  "math-g1-m13-division-table", "math-g2-m1-div-table", "math-g2-m1-muldiv-relation",
  "math-g2-m2-div-col", "math-g2-m4-division-meaning", "math-g2-m7-pic-div",
  "math-g2-m7-pic-div-include", "math-g2-m8-div-partitive", "math-g2-m8-div-quotative",
  "math-g3-m1-g3-div1", "math-g4-c2-c2-divisible", "math-g4-m1-g4-oral-divt",
  "math-g4-m2-g4-v-div2", "math-g4-m2-g4-v-div2q", "math-g4-m8-g4-word-div",
  "math-g5-c2-divisibility", "math-g6-c2-divisibility",
  "math-g1-m1-mixed-chain", "math-g2-m1-mixed-addsub", "math-g2-m1-mixed-multdiv",
  "math-g2-m3-chain-addsub", "math-g2-m3-multdiv-mixed", "math-g2-m3-mixed-no-bracket",
  "math-g2-m3-mixed-bracket", "math-g1-m4-num-fill-unknown", "math-g2-m3-fill-operator",
  "math-g2-m1-mixed-addsub", "math-g2-m1-mixed-multdiv",
  "math-g1-m13-multiplication-table", "math-g1-m13-division-table", "math-g1-m13-fill-blank",
  "math-g2-m4-length-unit", "math-g2-m4-mass-unit", "math-g2-m4-time-unit",
  "math-g2-m4-fill-length", "math-g2-m4-fill-mass", "math-g2-m4-fill-time",
  "math-g3-m4-g3-measure", "math-g4-c4-c4-cutfill", "math-g4-c4-c4-pa",
  "math-g4-c4-c4-solid", "math-g4-c4-c4-count",
  "math-g1-m12-choice-mixed", "math-g1-m5-match-calc", "math-g1-m5-match-shape",
  "math-g1-m5-match-clock", "math-g1-m5-match-rmb", "math-g2-m12-choice-mixed",
  "math-g1-m0-make-ten-cushi", "math-g1-m11-judge-mixed", "math-g2-m11-judge-mixed",
  "math-g1-m1-mixed-chain", "math-g2-m1-mixed-addsub", "math-g2-m1-mixed-multdiv",
  "math-g2-m3-chain-addsub", "math-g2-m3-multdiv-mixed", "math-g2-m3-mixed-no-bracket",
  "math-g2-m3-mixed-bracket", "math-g1-m4-num-fill-unknown", "math-g2-m3-fill-operator",
  "math-g4-m1-g4-oral-divt", "math-g4-m2-g4-v-div2", "math-g4-m2-g4-v-div2q",
  "math-g4-m8-g4-word-div", "math-g5-c2-divisibility", "math-g6-c1-vertical-multidigit",
  "math-g6-c2-divisibility", "math-g6-c3-multiplication-principle"
];

var allKPs = new Set();
["math", "chinese", "english"].forEach(function(subj) {
  [1,2,3,4,5,6].forEach(function(g) { (KB.getEntries(subj, g) || []).forEach(function(e) { allKPs.add(e.id); }); });
});

natKPs.forEach(function(kp) {
  if (!allKPs.has(kp)) console.log("MISSING:", kp);
});
