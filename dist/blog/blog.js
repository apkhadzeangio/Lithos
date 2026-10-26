(() => {
  const tools = document.querySelector('[data-blog-tools]');
  if (!tools) return;
  const search = document.querySelector('#blog-search');
  const buttons = [...document.querySelectorAll('[data-blog-category]')];
  const cards = [...document.querySelectorAll('#blog-grid > .blog-card')];
  const count = document.querySelector('#blog-result-count');
  const empty = document.querySelector('#blog-empty');
  const normalize = value => value.normalize('NFKC').toLocaleLowerCase('ka-GE').trim();
  const text = new Map(cards.map(card => [card, normalize(card.textContent)]));
  let category = '';
  function render() {
    const words = normalize(search.value).split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const card of cards) {
      const matches = (!category || card.dataset.category === category) && words.every(word => text.get(card).includes(word));
      card.hidden = !matches;
      visible += Number(matches);
    }
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.blogCategory === category));
    count.textContent = `${visible} სტატია`;
    empty.hidden = visible !== 0;
  }
  tools.addEventListener('submit', event => event.preventDefault());
  search.addEventListener('input', render);
  for (const button of buttons) button.addEventListener('click', () => {category = button.dataset.blogCategory; render();});
  document.querySelector('#blog-reset').addEventListener('click', () => {search.value = ''; category = ''; render(); search.focus();});
  tools.hidden = false;
  render();
})();
