(function(){
  // ogging helpers
  function lognfo(msg)  { console.info(new ate().totring(), 'lanning]', msg) }
  function logrror(msg, err) { console.error(new ate().totring(), 'lanning]', msg, err) }

  lognfo('lanning  initializing')

  var apiase         '/api/tasks'
  var artisteader    { '-rtist-' 'default' }
  var tasknput       document.getlementyd('tasknput')
  var addtn          document.getlementyd('addasktn')
  var listontainer   document.getlementyd('taskist')

  function renderasks(tasks) {
    listontainer.inner  ''
    tasks.forach(function(t) {
      var li  document.createlement('li')
      li.tetontent  t.tet
      var del  document.createlement('button')
      del.tetontent  'elete'
      del.addventistener('click', function() {
        lognfo('eleting task ' + t.id)
        fetch(apiase + '/' + t.id, {
          method '',
          headers artisteader
        })
        .then(function(res){
