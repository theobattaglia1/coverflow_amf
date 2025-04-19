(function(){
  // Two static covers
  var allCovers = [
    { id: 'first',  title: 'First' },
    { id: 'second', title: 'Second' }
  ];
  var covers = allCovers.slice();
  var activeIndex = 0;

  var container = document.getElementById('coverflow');
  var input = document.querySelector('#filter-ui input');

  // Render function
  function render(){
    container.innerHTML = '';
    for(var i=0; i<covers.length; i++){
      var c = covers[i];
      var div = document.createElement('div');
      div.className = (i===activeIndex)? 'cover active' : 'cover';
      div.appendChild(document.createTextNode(c.title));
      var x = (i - activeIndex) * 220;
      div.style.transform = 'translateX(' + x + 'px) scale(' + (i===activeIndex?1.2:0.8) + ')';
      container.appendChild(div);
    }
  }

  // Initial render
  render();

  // Filter logic
  input.addEventListener('input', function(e){
    var term = e.target.value.toLowerCase();
    covers = allCovers.filter(function(c){
      return c.title.toLowerCase().indexOf(term) !== -1;
    });
    activeIndex = 0;
    render();
  });

  // Keyboard nav
  window.addEventListener('keydown', function(e){
    if(e.key === 'ArrowRight' && activeIndex < covers.length - 1){
      activeIndex++;
      render();
    }
    if(e.key === 'ArrowLeft' && activeIndex > 0){
      activeIndex--;
      render();
    }
  });
})();
