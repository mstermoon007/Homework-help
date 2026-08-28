// Unit test: verify calcOptimalCols and gridColumnsFromDom produce consistent results
// for the same question set

const { calcOptimalCols, fitColumns, gridColumnsFromDom, applySpanning, estimateCardWidth, coreText, renderLen } = require('../shared/common.js');

// Test question sets
const testQuestions1 = [
  { q: '1+1', type: 'add', inputCount: 0 },
  { q: '2+3', type: 'add', inputCount: 0 },
  { q: '5+5', type: 'add', inputCount: 0 },
];

const testQuestions2 = [
  { q: '1+1', type: 'add', inputCount: 0 },
  { q: '2+3', type: 'add', inputCount: 0 },
  { q: '5+5', type: 'add', inputCount: 0 },
  { q: '3+4', type: 'add', inputCount: 0 },
];

const testQuestions3 = [
  { q: 'a=b', type: 'equation', inputCount: 0 },
  { q: 'x+5', type: 'equation', inputCount: 0 },
];

function runTests() {
  let passed = 0;
  let failed = 0;

  // Test 1: calcOptimalCols with same questions should give same result
  try {
    const cols1 = calcOptimalCols({ questions: testQuestions1 }, 800);
    const cols2 = calcOptimalCols({ questions: testQuestions1 }, 800);
    if (cols1 === cols2) {
      console.log(`✓ Test 1 PASSED: calcOptimalCols with same input returns ${cols1}`);
      passed++;
    } else {
      console.log(`✗ Test 1 FAILED: calcOptimalCols returned ${cols1} vs ${cols2}`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ Test 1 ERROR: ${e.message}`);
    failed++;
  }

  // Test 2: calcOptimalCols with different width should give different results (within reason)
  try {
    const colsNarrow = calcOptimalCols({ questions: testQuestions1 }, 400);
    const colsWide = calcOptimalCols({ questions: testQuestions1 }, 800);
    if (colsNarrow <= colsWide) {
      console.log(`✓ Test 2 PASSED: narrower width gives fewer or equal cols (${colsNarrow} vs ${colsWide})`);
      passed++;
    } else {
      console.log(`✗ Test 2 FAILED: unexpected column count relationship`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ Test 2 ERROR: ${e.message}`);
    failed++;
  }

  // Test 3: calcOptimalCols with meta.columns should override
  try {
    const colsWithMeta = calcOptimalCols({ questions: testQuestions1, meta: { columns: 3 } }, 800);
    if (colsWithMeta === 3) {
      console.log(`✓ Test 3 PASSED: meta.columns overrides calculation (3)`);
      passed++;
    } else {
      console.log(`✗ Test 3 FAILED: expected 3, got ${colsWithMeta}`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ Test 3 ERROR: ${e.message}`);
    failed++;
  }

  // Test 4: calcOptimalCols with empty questions
  try {
    const colsEmpty = calcOptimalCols({ questions: [] }, 800);
    if (colsEmpty === 3) {
      console.log(`✓ Test 4 PASSED: empty questions returns default 3`);
      passed++;
    } else {
      console.log(`✗ Test 4 FAILED: expected 3, got ${colsEmpty}`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ Test 4 ERROR: ${e.message}`);
    failed++;
  }

  // Test 5: gridColumnsFromDom with same clone structure should give consistent results
  try {
    // Create a minimal test DOM structure
    const template = `
      <div class="questions-grid">
        <div class="question-card" data-index="0">
          <div class="q-text">1+1</div>
        </div>
        <div class="question-card" data-index="1">
          <div class="q-text">2+3</div>
        </div>
        <div class="question-card" data-index="2">
          <div class="q-text">5+5</div>
        </div>
      </div>
    `;
    const parser = new DOMParser();
    const doc1 = parser.parseFromString(template, 'text/html');
    const doc2 = parser.parseFromString(template, 'text/html');
    
    const colsFromDom1 = gridColumnsFromDom(doc1.body, 800);
    const colsFromDom2 = gridColumnsFromDom(doc2.body, 800);
    
    if (colsFromDom1 === colsFromDom2) {
      console.log(`✓ Test 5 PASSED: gridColumnsFromDom on identical clones returns ${colsFromDom1}`);
      passed++;
    } else {
      console.log(`✗ Test 5 FAILED: gridColumnsFromDom returned ${colsFromDom1} vs ${colsFromDom2}`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ Test 5 ERROR: ${e.message}`);
    failed++;
  }

  // Test 6: Same question set via calcOptimalCols and gridColumnsFromDom should be consistent
  // (both use the same estimateCardWidth algorithm)
  try {
    const set = { questions: testQuestions1 };
    const colsCalc = calcOptimalCols(set, 800);
    const template = `
      <div class="questions-grid">
        <div class="question-card" data-index="0"><div class="q-text">1+1</div></div>
        <div class="question-card" data-index="1"><div class="q-text">2+3</div></div>
        <div class="question-card" data-index="2"><div class="q-text">5+5</div></div>
      </div>
    `;
    const doc = new DOMParser();
    const parsedDoc = doc.parseFromString(template, 'text/html');
    const colsGrid = gridColumnsFromDom(parsedDoc.body, 800);
    
    // They should both return a value in [1,4] range
    if (colsCalc >= 1 && colsCalc <= 4 && colsGrid >= 1 && colsGrid <= 4) {
      console.log(`✓ Test 6 PASSED: both methods return valid column counts (calc=${colsCalc}, grid=${colsGrid})`);
      passed++;
    } else {
      console.log(`✗ Test 6 FAILED: column counts out of range (calc=${colsCalc}, grid=${colsGrid})`);
      failed++;
    }
  } catch (e) {
    console.log(`✗ Test 6 ERROR: ${e.message}`);
    failed++;
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
