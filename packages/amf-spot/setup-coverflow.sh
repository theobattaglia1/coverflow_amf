#!/usr/bin/env bash
set -e

# 1. Create data dir + initial JSON
mkdir -p data
if [ ! -f data/coverflow.json ]; then
  echo "[]" > data/coverflow.json
  echo "✅ Created data/coverflow.json"
else
  echo "ℹ️  data/coverflow.json already exists, skipping"
fi

# 2. Inject Coverflow API endpoints into server.js
SERVER="server.js"
if ! grep -q "GET /api/coverflow" "$SERVER"; then
  awk '/^\/\/ — uploads/ {
    print
    print "\n// — Coverflow API"
    print "app.get(\"/api/coverflow\", (req,res) => res.json(require(\"./data/coverflow.json\")));"
    print "app.post(\"/api/coverflow\", (req,res) => {"
    print "  const fs = require(\"fs\");"
    print "  const p  = require(\"path\").join(__dirname,\"data\",\"coverflow.json\");"
    print "  fs.writeFileSync(p, JSON.stringify(req.body,null,2));"
    print "  res.json({status:'ok'});"
    print "});\n"
    next
  }1' "$SERVER" > tmp && mv tmp "$SERVER"
  echo "✅ Injected /api/coverflow endpoints into $SERVER"
else
  echo "ℹ️  /api/coverflow endpoints already present, skipping"
fi

# 3. Add Coverflow‑Editor section to admin/index.html
ADMIN_IDX="public/admin/dashboard/index.html"
if ! grep -q "id=\"coverflow-editor\"" "$ADMIN_IDX"; then
  awk '/<section id="events-section"/ {
    print
    print "  <!-- Coverflow Editor -->"
    print "  <section id=\"coverflow-editor\">"
    print "    <h2>Coverflow Slides</h2>"
    print "    <ul id=\"slides-list\"></ul>"
    print "    <button id=\"add-slide\">+ Add Slide</button>"
    print "    <button id=\"save-slides\">Save All</button>"
    print "  </section>\n"
    next
  }1' "$ADMIN_IDX" > tmp && mv tmp "$ADMIN_IDX"
  echo "✅ Injected Coverflow editor section into $ADMIN_IDX"
else
  echo "ℹ️  Coverflow editor section already in $ADMIN_IDX"
fi

# 4. Append Coverflow‑Editor JS to admin/dashboard.js
ADMIN_JS="public/admin/dashboard/dashboard.js"
if ! grep -q "function loadSlides" "$ADMIN_JS"; then
  cat << 'EOD' >> "$ADMIN_JS"

// — Coverflow Editor logic
;(function(){
  const list = document.getElementById('slides-list');
  let slides = [];
  const artist = window.location.pathname.split('/')[2];

  async function loadSlides() {
    slides = await fetch('/api/coverflow').then(r=>r.json());
    renderList();
  }

  function renderList() {
    list.innerHTML = '';
    slides.forEach((s,i) => {
      const li = document.createElement('li');
      li.draggable = true;
      li.dataset.index = i;
      li.innerHTML = \`
        <div class="slide-item">
          <label>Image: <input type="file" data-prop="image"/></label>
          <label>Title: <input type="text" data-prop="title" value="\${s.title}"/></label>
          <label>Subtitle: <input type="text" data-prop="subtitle" value="\${s.subtitle}"/></label>
          <label>Link: <input type="url" data-prop="link" value="\${s.link}"/></label>
          <button class="remove">×</button>
        </div>\`;
      // wire up the inputs
      li.querySelectorAll('[data-prop]').forEach(inp=>{
        inp.addEventListener('change', e=>{
          const prop = e.target.dataset.prop;
          if(prop==='image') {
            const file = e.target.files[0];
            if(!file) return;
            const fm = new FormData();
            fm.append('file', file);
            fetch(\`/api/\${artist}/upload-image\`, {method:'POST',body:fm})
              .then(r=>r.json())
              .then(j=> slides[i].image = \`/uploads/images/\${artist}/\${j.filename}\`);
          } else {
            slides[i][prop] = e.target.value;
          }
        });
      });
      // remove button
      li.querySelector('.remove').onclick = ()=> {
        slides.splice(i,1);
        renderList();
      };
      // drag & drop
      li.addEventListener('dragstart', e=> dragIdx = i);
      li.addEventListener('dragover', e=> e.preventDefault());
      li.addEventListener('drop', e=> {
        [slides[dragIdx],slides[i]] = [slides[i],slides[dragIdx]];
        renderList();
      });
      list.appendChild(li);
    });
  }

  // add + save buttons
  document.getElementById('add-slide').onclick = () => {
    slides.push({image:'', title:'New slide', subtitle:'', link:''});
    renderList();
  };
  document.getElementById('save-slides').onclick = () => {
    fetch('/api/coverflow',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(slides)
    }).then(_=> alert('Slides saved!'));
  };

  loadSlides();
})();
EOD
  echo "✅ Appended Coverflow Editor JS to $ADMIN_JS"
else
  echo "ℹ️  Coverflow Editor JS already present in $ADMIN_JS"
fi

# 5. Create partner coverflow.css & coverflow.js
mkdir -p public/partner/dashboard

PART_CSS="public/partner/dashboard/coverflow.css"
if [ ! -f "$PART_CSS" ]; then
  cat << 'EOD' > "$PART_CSS"
#coverflow-hero {
  perspective: 1200px;
  height: 360px;
  overflow: hidden;
  position: relative;
}
.coverflow__item {
  position: absolute;
  top: 50%; left: 50%;
  transform-style: preserve-3d;
  transition: transform 0.6s, opacity 0.6s;
  cursor: pointer;
}
.coverflow__item img {
  width: 240px;
  border-radius: 8px;
  box-shadow: 0 8px 16px rgba(0,0,0,0.3);
}
.coverflow__caption {
  position: absolute;
  bottom: -3rem;
  left: 50%;
  transform: translateX(-50%);
  color: #fff;
  text-shadow: 0 2px 6px rgba(0,0,0,0.8);
  text-align: center;
}
EOD
  echo "✅ Created partner CSS at $PART_CSS"
else
  echo "ℹ️  $PART_CSS exists, skipping"
fi

PART_JS="public/partner/dashboard/coverflow.js"
if [ ! -f "$PART_JS" ]; then
  cat << 'EOD' > "$PART_JS"
// — Partner Coverflow Hero
(async function(){
  const data = await fetch('/api/coverflow').then(r=>r.json());
  const cont = document.getElementById('coverflow');
  let current = 0;

  data.forEach((s,i)=>{
    const el = document.createElement('div');
    el.className = 'coverflow__item';
    el.innerHTML = \`
      <img src="\${s.image}" alt="\${s.title}"/>
      <div class="coverflow__caption">
        <h3>\${s.title}</h3>
        <p>\${s.subtitle}</p>
      </div>\`;
    el.onclick = ()=> location.href = s.link;
    cont.appendChild(el);
  });

  function update(){
    Array.from(cont.children).forEach((el,i)=>{
      const offset = i - current;
      const angle  = offset * 30;
      const x      = offset * 200;
      el.style.opacity = Math.abs(offset)>3 ? 0 : 1;
      el.style.transform = \`
        translateX(\${x}px)
        translateZ(\${-Math.abs(offset)*150}px)
        rotateY(\${angle}deg)\`;
    });
  }
  update();

  document.addEventListener('keydown',e=>{
    if(e.key==='ArrowRight' && current<data.length-1) current++;
    if(e.key==='ArrowLeft'  && current>0)             current--;
    update();
  });
  let startX;
  cont.addEventListener('pointerdown',e=>startX=e.clientX);
  cont.addEventListener('pointerup',e=>{
    const dx = e.clientX - startX;
    if(dx>50 && current>0) current--;
    if(dx<-50 && current<data.length-1) current++;
    update();
  });
})();
EOD
  echo "✅ Created partner JS at $PART_JS"
else
  echo "ℹ️  $PART_JS exists, skipping"
fi

# 6. Inject <link> / <script> & <section> into partner index.html
PART_IDX="public/partner/dashboard/index.html"
if ! grep -q "coverflow.css" "$PART_IDX"; then
  sed -i '' '/<\/head>/ i\
  <link rel="stylesheet" href="coverflow.css">\
  <script defer src="coverflow.js"></script>' "$PART_IDX"
  sed -i '' '/<body>/ a\
  <section id="coverflow-hero"><div id="coverflow" class="coverflow"></div></section>' "$PART_IDX"
  echo "✅ Injected Coverflow Hero into $PART_IDX"
else
  echo "ℹ️  Partner index already has coverflow includes, skipping"
fi

echo "🎉 All done!  Restart your server and head to:"
echo "   • Admin editor → http://localhost:${PORT:-3000}/admin/{artist}/dashboard"
echo "   • Partner hero  → http://localhost:${PORT:-3000}/{artist}/dashboard"
