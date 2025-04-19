// packages/amf-spot/api.push.test.js
const fs = require('fs-extra');
const path = require('path');
const request = require('supertest');
const app = require('./server');

describe('Push endpoints', () => {
  const artist = 'testArtist';
  const dir = path.join(__dirname, 'data', artist);
  const coversFile = path.join(dir, 'covers.json');
  const stylesFile = path.join(dir, 'styles.json');
  const testCovers = path.join(dir, 'test-covers.json');
  const testStyles = path.join(dir, 'test-styles.json');

  beforeAll(async () => {
    // seed with known data
    await fs.remove(dir);
    await fs.mkdirp(dir);
    await fs.writeJson(coversFile, [{ id: 'x' }], { spaces: 2 });
    await fs.writeJson(stylesFile, { fontFamily: 'A', fontSize: 10, fonts: [], overrides: {} }, { spaces: 2 });
  });

  afterAll(async () => {
    await fs.remove(dir);
  });

  it('POST /push-to-test copies covers & styles to test files', async () => {
    const res = await request(app)
      .post('/push-to-test')
      .set('X-Artist-ID', artist);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    const tc = await fs.readJson(testCovers);
    const ts = await fs.readJson(testStyles);
    expect(tc).toEqual([{ id: 'x' }]);
    expect(ts.fontFamily).toBe('A');
  });

  it('POST /push-to-live copies test files back to live files', async () => {
    // mutate test files
    await fs.writeJson(testCovers, [{ id: 'y' }], { spaces: 2 });
    await fs.writeJson(testStyles, { fontFamily: 'B', fontSize: 12, fonts: [], overrides: {} }, { spaces: 2 });

    const res = await request(app)
      .post('/push-to-live')
      .set('X-Artist-ID', artist);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    const liveC = await fs.readJson(coversFile);
    const liveS = await fs.readJson(stylesFile);
    expect(liveC).toEqual([{ id: 'y' }]);
    expect(liveS.fontFamily).toBe('B');
  });
});

