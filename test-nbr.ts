const { getSentinelToken } = require('./lib/sentinel-hub/auth');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const token = await getSentinelToken();
  const fromDate = '2026-06-15';
  const toDate = '2026-07-15';
  const geoJsonPolygon = {
    "type": "Polygon",
    "coordinates": [
      [
        [ 115.15878200531007, -8.647313627244583 ],
        [ 115.15865325927736, -8.647573429381534 ],
        [ 115.1593452692032, -8.647700688325997 ],
        [ 115.15951156616212, -8.647462086968943 ],
        [ 115.15878200531007, -8.647313627244583 ]
      ]
    ]
  };

  const evalscript = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B08","B12","dataMask"] }],
    output: [
      { id: "nbr", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  return { nbr: [(s.B08-s.B12)/(s.B08+s.B12)], dataMask: [s.dataMask] };
}`;

  const body = {
    input: {
      bounds: {
        geometry: geoJsonPolygon,
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
      },
      data: [{ type: 'sentinel-2-l2a', dataFilter: { maxCloudCoverage: 100 } }],
    },
    aggregation: {
      timeRange: { from: `${fromDate}T00:00:00Z`, to: `${toDate}T23:59:59Z` },
      aggregationInterval: { of: 'P1D' },
      evalscript,
      resx: 10,
      resy: 10,
    },
    calculations: { default: {} },
  };

  const res = await fetch('https://sh.dataspace.copernicus.eu/api/v1/statistics', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  console.log('Status:', res.status);
  if (res.status === 200) {
    const json = JSON.parse(text);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.log(JSON.stringify(json.data.map((d: any) => ({
      date: d.interval.from,
      mean: d.outputs?.nbr?.bands?.B0?.stats?.mean
    })), null, 2));
  } else {
    console.log('Error:', text);
  }
}

run().catch(console.error);
