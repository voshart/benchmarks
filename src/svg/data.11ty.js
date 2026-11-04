module.exports = class {
  data() {
    return { permalink: '/svg/data.json', eleventyExcludeFromCollections: true };
  }
  render() {
    const { panels, reportingGroups, ...data } = require('../../lib/load-svg.cjs').loadSVG();
    return JSON.stringify(data);
  }
};
