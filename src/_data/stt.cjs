const { loadSTT } = require('../../lib/load-stt.cjs');
const Speech = require('../assets/js/speech.js');
const Matrix = require('../assets/js/speech-matrix.js');

module.exports = () => {
  const data = loadSTT();
  return {
    ...data,
    initial: Matrix.build(data),
    protocolInitial: Speech.build(data, { compact: true }),
    initialTiming: Matrix.timingRows(data, { test: 'fermion-20-dictations' }),
    modelNames: Object.fromEntries(data.models.map((model) => [model.id, model.name])),
    throughputTests: data.tests.filter((test) => test.task === 'throughput'),
    timingHardware: [...new Set(data.throughput.map((record) => record.hardware))].sort(),
    counts: {
      models: data.models.length,
      observations: data.rawRecords.length,
      sources: Object.keys(data.sources).length,
      sizes: data.sizes.length,
      throughput: data.throughput.length,
      latency: data.latency.length
    }
  };
};
