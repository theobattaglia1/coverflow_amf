// packages/amf-spot/api.test.js
const fs = require('fs-extra')
const path = require('path')
const request = require('supertest')
const app = require('./server')

describe('AMF‑Spot API', () => {
  const artistID = 'testArtist'
  const artistDir = path.join(__dirname, 'data', artistID)

  beforeAll(async () => {
    // Clean slate
    await fs.remove(artistDir)
  })

  afterAll(async () => {
    // Remove test data
    await fs.remove(artistDir)
  })

  test('GET /api/styles returns default styles', async () => {
    const res = await request(app)
      .get('/api/styles')
      .set('X-Artist-ID', artistID)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ fontFamily: 'GT America', fontSize: 16 })
  })

  test('GET /api/covers returns empty array', async () => {
    const res = await request(app)
      .get('/api/covers')
      .set('X-Artist-ID', artistID)
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  test('POST /save-cover appends a new cover', async () => {
    const cover = { id: 'abc', title: 'My Cover' }
    const res = await request(app)
      .post('/save-cover')
      .send(cover)
      .set('X-Artist-ID', artistID)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })

    const covers = await fs.readJson(path.join(artistDir, 'covers.json'))
    expect(covers).toContainEqual(cover)
  })

  test('POST /save-covers replaces covers array', async () => {
    const coversArray = [{ id: 'one' }, { id: 'two' }]
    const res = await request(app)
      .post('/save-covers')
      .send(coversArray)
      .set('X-Artist-ID', artistID)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })

    const covers = await fs.readJson(path.join(artistDir, 'covers.json'))
    expect(covers).toEqual(coversArray)
  })

  test('POST /delete-cover removes specified cover', async () => {
    // start with two covers
    await fs.writeJson(path.join(artistDir, 'covers.json'), [{ id: 'x' }, { id: 'y' }])
    const res = await request(app)
      .post('/delete-cover')
      .send({ coverID: 'x' })
      .set('X-Artist-ID', artistID)
    expect(res.status).toBe(200)

    const covers = await fs.readJson(path.join(artistDir, 'covers.json'))
    expect(covers).toEqual([{ id: 'y' }])
  })
})

