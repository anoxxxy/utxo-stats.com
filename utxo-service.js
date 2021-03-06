var fs = require('fs');
var path = require('path');
var Client = require('bitcoin-core');
var scp = require('scp2');

var appDir = path.dirname(require.main.filename);

var client = new Client({
  username: process.env.BITCOIN_USERNAME,
  password: process.env.BITCOIN_PASSWORD,
  timeout: 60 * 1000 * 5
});

var scpOptions = {
  host: process.env.UTXO_STATS_HOST,
  username: process.env.UTXO_STATS_USERNAME,
  password: process.env.UTXO_STATS_PASSWORD,
  path: process.env.UTXO_STATS_PATH
};

var lastBlockHeight = 0;

function getBlockCount() {
  return client.command('getblockcount');
}

function getUTXOStats() {
  return client.command('gettxoutsetinfo', true);
}

function saveUTXOStats(stats) {
  var meta = {
    updated_at: Math.floor(new Date().getTime() / 1000)
  };

  Object.keys(stats).forEach(function (key) {
    if (key === 'map_utxo_count' || key === 'map_utxo_amount') {
      return;
    }

    meta[key] = stats[key];
  });

  fs.writeFileSync(appDir + '/public/data/map-utxo-count', stats.map_utxo_count);
  fs.writeFileSync(appDir + '/public/data/map-utxo-amount', stats.map_utxo_amount);
  fs.writeFileSync(appDir + '/public/data/meta.json', JSON.stringify(meta));
}

function uploadUTXOFiles(callback) {
  scp.scp(appDir + '/public/data/', scpOptions, function (err) {
    if (err) {
      console.error(err);
    }

    callback();
  });
}

setInterval(function () {
  getBlockCount().then(function (height) {
    if (height === lastBlockHeight) {
      return;
    }

    lastBlockHeight = height;

    console.log('Processing stats for block ' + height + '...');

    return getUTXOStats().then(function (stats) {
      console.log('  Saving and uploading data...');
      saveUTXOStats(stats);

      uploadUTXOFiles(function () {
        console.log('  Done');
      });
    });
  }).catch(function (err) {
    console.error(err);
  });
}, 60 * 3 * 1000);
