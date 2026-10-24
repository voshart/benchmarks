const { loadOCR } = require('../lib/load.cjs');
const { loadSTT } = require('../lib/load-stt.cjs');

for (const [topic, data] of [
  ['ocr', loadOCR()],
  ['stt', loadSTT()]
]) {
  console.log(
    JSON.stringify(
      {
        topic,
        snapshot: data.config.snapshot_date,
        models: data.models.length,
        protocols: (data.accuracyTests || data.tests).length,
        observations: data.rawRecords.length,
        sources: Object.keys(data.sources).length,
        throughput: data.throughput.length,
        prices: data.pricing.length,
        tokenPrices: data.tokenPricing.length
      },
      null,
      2
    )
  );
}
