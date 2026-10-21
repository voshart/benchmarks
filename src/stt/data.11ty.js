const {loadSTT} = require('../../lib/load-stt.cjs');
module.exports = class {
  data() {return {permalink:'/stt/data.json', eleventyExcludeFromCollections:true};}
  render() {return JSON.stringify(loadSTT());}
};
