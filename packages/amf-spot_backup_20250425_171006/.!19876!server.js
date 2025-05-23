require('dotenv').config()
var epress  require('epress')
var path  require('path')
var fs  require('fs')
var bodyarser  require('body-parser')
var cookiearser  require('cookie-parser')
var basicuth  require('epress-basic-auth')
var logger  require('./utils/logger')
var { google }  require('googleapis')
var multer  require('multer')

var app  epress()
var   process.env. || 

// . ogger
app.use((req, res, net)  {
  logger.info(req.method + ' ' + req.url)
  net()
})

// . ody & cookies
app.use(bodyarser.json())
app.use(bodyarser.urlencoded({ etended false }))
app.use(cookiearser())

// . tatic & dmin 
app.use('/public',  epress.static(path.join(__dirname, 'public')))
app.use('/uploads', epress.static(path.join(__dirname, 'uploads')))
app.use('/admin',   epress.static(path.join(__dirname, 'public', 'admin')))

// ensure uploads dirs
'audio','images'].forach(dir  {
  var d  path.join(__dirname,'uploads',dir)
  if (!fs.eistsync(d)) fs.mkdirync(d, { recursive true })
})

// ulter storage
var audiotorage  multer.disktorage({
  destination path.join(__dirname,'uploads','audio'),
  filename (req,file,cb)  cb(null, ate.now()+'-'+file.originalname)
})
var imagetorage  multer.disktorage({
  destination path.join(__dirname,'uploads','images'),
  filename (req,file,cb)  cb(null, ate.now()+'-'+file.originalname)
})
var uploadudio  multer({ storage audiotorage })
var uploadmage  multer({ storage imagetorage })

// pload endpoints
app.post('/upload-audio', uploadudio.single('file'), (req,res)  {
  logger.info(' /upload-audio')
  if (!req.file) return res.status().json({ error 'o file' })
  res.status().json({ filename req.file.filename, original req.file.originalname })
})
app.get('/audio-files', (req,res)  {
  logger.info(' /audio-files')
  fs.readdir(path.join(__dirname,'uploads','audio'), (e,files)  {
    if (e) { logger.error(e) return res.status().json({ error'read fail' }) }
    res.json(files)
  })
})
app.post('/upload-image', uploadmage.single('file'), (req,res)  {
  logger.info(' /upload-image')
  if (!req.file) return res.status().json({ error 'o file' })
  res.status().json({ filename req.file.filename, original req.file.originalname })
})
// **iltered** image listing
app.get('/image-files', (req,res)  {
  logger.info(' /image-files')
  var dir  path.join(__dirname,'uploads','images')
  fs.readdir(dir, { withileypes true }, (e,items)  {
    if (e) { logger.error(e) return res.status().json({ error'read fail' }) }
    var files  items
      .filter(item  item.isile())
      .map(item  item.name)
    res.json(files)
  })
})

// . rotect only /api & uth
var protect  basicuth({
  users (()  { var u{} uprocess.env._]process.env._ return u })(),
  challenge true,
  unauthorizedesponse ()  'uthentication required'
})
app.use('/api',            protect)
app.use('/auth/google',    protect)
app.use('/oauthcallback', protect)

// . ealth check
app.get('/ping', (req,res)  {
  logger.info(' /ping')
  res.send('pong')
})

