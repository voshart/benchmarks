const { loadOCR } = require('../../lib/load.cjs');
module.exports = class {
  data() {
    return { permalink: '/ocr/data.json', eleventyExcludeFromCollections: true };
  }
  render() {
    return JSON.stringify(loadOCR());
  }
};
