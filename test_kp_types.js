var KB = require('./shared/knowledge-bank.js');
var O = require('./shared/knowledge-ontology.js');

O.SUBJECTS.forEach(function(s) {
  (KB[s] || []).forEach(function(g) {
    (g.modules || []).forEach(function(m) {
      (m.knowledgePoints || []).forEach(function(kp) {
        if (kp.applicable_question_types || kp.type) {
          console.log(kp.id, 'type:', kp.type, 'aqts:', kp.applicable_question_types);
        }
      });
    });
  });
});