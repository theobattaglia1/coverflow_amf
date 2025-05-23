// 🚨 FULL DEBUG SHOWCASE.JS
console.log('🚀 [SHOWCASE] script loaded from:', document.currentScript.src);
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 [SHOWCASE] DOMContentLoaded');
  var container = document.getElementById('showcase');
  if (!container) {
    console.error('❌ [SHOWCASE] #showcase not found');
    return;
  }
  console.log('✅ [SHOWCASE] container:', container);

  // style & dims
  container.style.position = 'relative';
  var W = container.clientWidth, H = container.clientHeight;
  console.log('📐 container size:', W + '×' + H);
  var CX = W/2, CY = H/2, R = Math.min(W,H)/2 * 0.85;
  console.log('⚙️ center (CX,CY):', CX, CY, ' radius R:', R);

  // fetch data
  fetch('/api/hudson-ingram/showcase')
    .then(function(r) {
      console.log('🔄 fetch status', r.status);
      return r.json();
    })
    .then(function(data) {
      console.log('🎯 raw data:', data);
      var items = Array.isArray(data.media) && data.media.length
                  ? data.media
                  : fallback(12);
      console.log('🎯 items to render:', items);
      render(items);
    })
    .catch(function(err) {
      console.error('❗ fetch error:', err);
      render(fallback(12));
    });

  function fallback(n) {
    console.log('📦 using fallback x' + n);
    var a = [];
    for(var i=0;i<n;i++){
      a.push({ title:'Fallback '+(i+1), thumbnail:null, uploadedAt:null });
    }
    return a;
  }

function render(items) {                                                        
  console.log("🎨 render()", items.length, "items");                              
  container.innerHTML = "";                                                      
  var layer = document.createElement("div");                                     
  layer.className = "art-circles-display";                                       
  container.appendChild(layer);                                                  
  /* equal‐spacing around the circle */                                          
  items.forEach(function(item,i){                                                
    var deg = 90 + i*(360/items.length);                                         
    place(item,deg,layer);                                                       
  });                                                                            
}