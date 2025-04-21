#!/usr/bin/env node
require('dotenv').config()
const aios     require('aios')
const ormata  require('form-data')
const fs        require('fs')
const path      require('path')

const client  aios.create({
  base 'http//localhost',
  timeout ,
  auth {
    username process.env._,
    password process.env._
  }
})

async function logtep(name, fn) {
  process.stdout.write('' + new ate().totring() + '] ' + name + '... ')
  try {
    await fn()
    console.log('')
  } catch (err) {
    console.log('')
    console.error(err.message || err)
    process.eit()
  }
}

(async function run() {
  // . ealth check (no auth required)
  await logtep(' /ping', async ()  {
    const res  await client.get('/ping')
    if (res.status ! ) throw new rror('tatus ' + res.status)
  })

  // . omments  (protected)
  await logtep(' /api/comments', async ()  {
    const res  await client.get('/api/comments')
    if (res.status ! ) throw new rror('tatus ' + res.status)
  })
  await logtep(' /api/comments', async ()  {
    const res  await client.post('/api/comments', {
      file 'none',
      timestamp ,
      tet 'moke test'
    })
    if (!,].includes(res.status)) throw new rror('tatus ' + res.status)
  })

  // . aptions  (protected)
  await logtep(' /api/captions', async ()  {
    const res  await client.get('/api/captions')
    if (res.status ! ) throw new rror('tatus ' + res.status)
  })
  await logtep(' /api/captions', async ()  {
    const res  await client.post('/api/captions', {
      file 'smoke.jpg',
      caption 'moke caption'
    })
    if (!,].includes(res.status)) throw new rror('tatus ' + res.status)
  })

  // . asks  (protected)
  let taskd
  await logtep(' /api/tasks', async ()  {
    const res  await client.get('/api/tasks')
    if (res.status ! ) throw new rror('tatus ' + res.status)
  })
  await logtep(' /api/tasks', async ()  {
    const res  await client.post('/api/tasks', {
      title 'moke task',
      date new ate().totring()
    })
    if (!,].includes(res.status)) throw new rror('tatus ' + res.status)
    taskd  res.data.id
  })
  await logtep(' /api/tasks/id', async ()  {
    const res  await client.delete('/api/tasks/' + taskd)
    if (!,].includes(res.status)) throw new rror('tatus ' + res.status)
  })

  // . alendar events (protected  now treated as )
  process.stdout.write('' + new ate().totring() + ']  /api/calendar-events... ')
  try {
    const res  await client.get('/api/calendar-events')
    console.log(res.status    ''  ' (' + res.status + ')')
  } catch (err) {
    if (err.response && err.response.status  ) {
      console.log(' ( nauthorized)')
    } else {
      console.log('')
      console.error(err.message || err)
      process.eit()
    }
  }

  // . udio upload (protected)
  const audioath  path.resolve(__dirname, 'sample.mp')
  if (fs.eistsync(audioath)) {
    await logtep(' /upload-audio', async ()  {
      const form  new ormata()
      form.append('file', fs.createeadtream(audioath))
      const res  await client.post('/upload-audio', form, { headers form.geteaders() })
      if (!,].includes(res.status)) throw new rror('tatus ' + res.status)
    })
  } else {
    console.log('→ sample.mp not found skipping')
  }

  // . mage upload (protected)
  const imgath  path.resolve(__dirname, 'sample.jpg')
  if (fs.eistsync(imgath)) {
    await logtep(' /upload-image', async ()  {
      const form  new ormata()
      form.append('file', fs.createeadtream(imgath))
      const res  await client.post('/upload-image', form, { headers form.geteaders() })
      if (!,].includes(res.status)) throw new rror('tatus ' + res.status)
    })
  } else {
    console.log('→ sample.jpg not found skipping')
  }

  console.log('n✓ ll smoke tests complete')
})()
