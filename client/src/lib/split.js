// Splits an element's text into <span> per character or word so we can animate each one.
// The original text is kept in aria-label so screen readers still read it normally.

export function splitText(el, mode = 'chars') {
  if (!el || el.dataset.split === mode) return el.querySelectorAll(mode === 'chars' ? '.char' : '.word');
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.dataset.split = mode;
  el.innerHTML = '';

  const words = text.split(/(\s+)/);
  words.forEach((word) => {
    if (/^\s+$/.test(word)) {
      el.appendChild(document.createTextNode(' '));
      return;
    }
    const wordWrap = document.createElement('span');
    wordWrap.className = 'word';
    wordWrap.setAttribute('aria-hidden', 'true');
    wordWrap.style.display = 'inline-block';
    wordWrap.style.overflow = mode === 'chars' ? 'hidden' : 'visible';
    wordWrap.style.verticalAlign = 'top';
    wordWrap.style.whiteSpace = 'nowrap';

    if (mode === 'chars') {
      [...word].forEach((ch) => {
        const c = document.createElement('span');
        c.className = 'char';
        c.textContent = ch;
        c.style.display = 'inline-block';
        wordWrap.appendChild(c);
      });
    } else {
      wordWrap.textContent = word;
    }
    el.appendChild(wordWrap);
  });

  return el.querySelectorAll(mode === 'chars' ? '.char' : '.word');
}
