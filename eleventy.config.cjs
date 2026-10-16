module.exports=function(config){
 config.addPassthroughCopy({'src/assets':'assets'});
 const rankUI=require('./src/assets/js/rank-ui.js');
 config.addFilter('rankCell',rankUI.renderRank);
 config.addFilter('scoreTooltip',rankUI.scoreTooltip);
 config.addWatchTarget('data/');
 config.addWatchTarget('lib/');
 config.addFilter('money',v=>typeof v==='number'&&Number.isFinite(v)?v.toFixed(3).replace(/0+$/,'').replace(/\.$/,''):'—');
 config.addFilter('value', (v,unit)=> typeof v==='number'?(unit==='ratio'?v.toFixed(3):v.toFixed(1)):'—');
 config.addFilter('shade',(v,pair)=>!Number.isFinite(v)||!pair||pair[0]===null?'0%':pair[0]===pair[1]?'30%':String((30*Math.max(0,Math.min(1,(v-pair[0])/(pair[1]-pair[0])))).toFixed(1))+'%');
 return {dir:{input:'src',output:'_site',includes:'_includes',data:'_data'},htmlTemplateEngine:'njk',dataTemplateEngine:'njk'};
};
