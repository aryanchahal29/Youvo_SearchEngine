async function run() {
  const res = await fetch('https://api.github.com/search/repositories?q=open%20source%20video%20generator%20topic:ai&sort=stars&order=desc&per_page=10', {
    headers: { 'User-Agent': 'YouVo-Dev' }
  });
  const data = await res.json();
  console.log(data);
}
run();
