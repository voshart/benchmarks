const {loadOCR} = require('../lib/load.cjs');
const {validateData} = require('../lib/validate.cjs');
const data = loadOCR();
validateData(data);
console.log(`Validated ${data.models.length} models, ${data.records.length} observations, ${data.pricing.length} page prices, ${data.tokenPricing.length} token prices.`);
