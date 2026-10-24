const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'data');

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(root, file), 'utf8'));
  } catch (error) {
    throw new Error(`${file}: ${error.message}`, { cause: error });
  }
}

function readJSONL(file) {
  return fs
    .readFileSync(path.resolve(root, file), 'utf8')
    .split(/\r?\n/)
    .flatMap((line, index) => {
      if (!line.trim()) return [];
      try {
        return [JSON.parse(line)];
      } catch (error) {
        throw new Error(`${file}:${index + 1}: ${error.message}`, { cause: error });
      }
    });
}

function readProtocols(topic) {
  return fs
    .readdirSync(path.join(root, topic, 'tests'))
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => {
      const relative = `${topic}/tests/${file}`;
      const protocol = readJSON(relative);
      if (protocol.id !== path.basename(file, '.json')) {
        throw new Error(`${relative}: id must match the filename`);
      }
      return protocol;
    });
}

function readResults(topic, protocols) {
  const expected = new Set(protocols.map((protocol) => `${protocol.id}.jsonl`));
  for (const file of fs.readdirSync(path.join(root, topic, 'results'))) {
    if (file.endsWith('.jsonl') && !expected.has(file)) {
      throw new Error(`${topic}/results/${file}: no matching accuracy protocol`);
    }
  }
  return protocols.flatMap((protocol) =>
    readJSONL(`${topic}/results/${protocol.id}.jsonl`).map((record) => ({
      ...record,
      benchmark: protocol.id
    }))
  );
}

module.exports = { readJSON, readJSONL, readProtocols, readResults };
