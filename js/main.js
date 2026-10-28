// App shell: screens, saving progress, sounds, and the Android back button.

import { Game } from './game.js';
import { getLevel } from './levels.js';
import * as store from './storage.js';
import { play, unlockAudio, setSoundEnabled } from './audio.js';

const $ = (id) => document.getElementById(id);
let save = store.load();
setSoundEnabled(save.sound);

let game;
let currentLevel = 1;

function vibrate(pattern) {
  if (!save.vibrate) return;
  try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
}

function starsFor(mistakes) {
  if (mistakes === 0) return 3;
  if (mistakes <= 2) return 2;
  return 1;
}

const STAR_SVG = '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>';
const LOCK_SVG = '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

// ---------- screens ----------

function show(screen) {
  for (const id of ['home', 'levels', 'hud', 'win', 'settings']) $(id).classList.add('hidden');
  game?.setActive(screen === 'game');
  if (screen === 'home') {
    $('home').classList.remove('hidden');
    $('play-btn').textContent = save.unlocked > 1 ? `Play · Level ${save.unlocked}` : 'Play';
  } else if (screen === 'levels') {
    renderLevelGrid();
    $('levels').classList.remove('hidden');
  } else if (screen === 'game') {
    $('hud').classList.remove('hidden');
  }
}

function go(screen, data = {}, replace = false) {
  const state = { screen, ...data };
  if (replace) history.replaceState(state, '');
  else history.pushState(state, '');
  route(state);
}

function route(state) {
  const screen = state?.screen || 'home';
  if (screen === 'game') startLevel(state.level || save.unlocked);
  else show(screen);
  if (state?.modal === 'settings') openSettings();
}

window.addEventListener('popstate', (e) => route(e.state));

function renderLevelGrid() {
  const grid = $('level-grid');
  const shown = Math.ceil((save.unlocked + 1) / 30) * 30;
  grid.innerHTML = '';
  for (let n = 1; n <= shown; n++) {
    const btn = document.createElement('button');
    btn.className = 'level-tile';
    if (n > save.unlocked) {
      btn.classList.add('locked');
      btn.innerHTML = LOCK_SVG;
      btn.disabled = true;
      btn.setAttribute('aria-label', `Level ${n}, locked`);
    } else {
      const stars = save.stars[n] || 0;
      if (n === save.unlocked) btn.classList.add('current');
      btn.innerHTML = `${n}<small>${'★'.repeat(stars)}</small>`;
      btn.setAttribute('aria-label', `Level ${n}, ${stars} stars`);
      btn.addEventListener('click', () => { play('click'); go('game', { level: n }); });
    }
    grid.appendChild(btn);
  }
  grid.querySelector('.current')?.scrollIntoView({ block: 'center' });
}

// ---------- playing ----------

function startLevel(n) {
  currentLevel = n;
  show('game');
  game.load(getLevel(n));
  $('hud-level').textContent = `Level ${n}`;
  updateLeft();
  updateMistakes(0);
  $('help').classList.toggle('hidden', save.seenHelp || n > 1);
}

function updateLeft() {
  const left = game.remaining;
  $('hud-left').textContent = `${left} ${left === 1 ? 'cube' : 'cubes'} left`;
}

function updateMistakes(m) {
  const s = starsFor(m);
  $('hud-mistakes').textContent = '★'.repeat(s) + '☆'.repeat(3 - s);
  $('hud-mistakes').setAttribute('aria-label', `${s} stars`);
}

function onWin(mistakes) {
  const stars = starsFor(mistakes);
  save.stars[currentLevel] = Math.max(save.stars[currentLevel] || 0, stars);
  save.unlocked = Math.max(save.unlocked, currentLevel + 1);
  store.save(save);
  play('win');
  vibrate([20, 60, 20]);

  $('win-stars').innerHTML = [1, 2, 3].map((i) =>
    STAR_SVG.replace('<svg', `<svg class="${i <= stars ? 'on' : ''}"`)).join('');
  const msgs = { 3: 'Perfect — no bumps!', 2: 'Great job!', 1: 'Well done!' };
  $('win-text').textContent = msgs[stars];
  $('win').classList.remove('hidden');
}

// ---------- settings ----------

function openSettings() {
  $('sound-toggle').checked = save.sound;
  $('vibrate-toggle').checked = save.vibrate;
  $('settings').classList.remove('hidden');
}

// ---------- start up ----------

function init() {
  try {
    game = new Game($('stage'), {
      onRemove: () => {
        play('pop');
        vibrate(8);
        updateLeft();
        if (!save.seenHelp) {
          save.seenHelp = true;
          store.save(save);
          $('help').classList.add('hidden');
        }
      },
      onBump: () => { play('bump'); vibrate(35); },
      onMistake: updateMistakes,
      onWin,
    });
  } catch (err) {
    console.error(err);
    $('error').classList.remove('hidden');
    $('home').classList.add('hidden');
    return;
  }

  // Audio may only start after the first touch.
  window.addEventListener('pointerdown', unlockAudio, { once: false, passive: true });

  $('play-btn').addEventListener('click', () => { play('click'); go('game', { level: save.unlocked }); });
  $('levels-btn').addEventListener('click', () => { play('click'); go('levels'); });
  $('settings-btn').addEventListener('click', () => { play('click'); go('home', { modal: 'settings' }); });
  for (const b of document.querySelectorAll('[data-back]')) {
    b.addEventListener('click', () => { play('click'); history.back(); });
  }
  $('restart-btn').addEventListener('click', () => { play('click'); startLevel(currentLevel); });
  $('hint-btn').addEventListener('click', () => { play('click'); game.hint(); });
  $('next-btn').addEventListener('click', () => { play('click'); go('game', { level: currentLevel + 1 }, true); });
  $('win-menu-btn').addEventListener('click', () => { play('click'); history.back(); });

  $('sound-toggle').addEventListener('change', (e) => {
    save.sound = e.target.checked;
    setSoundEnabled(save.sound);
    store.save(save);
    play('click');
  });
  $('vibrate-toggle').addEventListener('change', (e) => {
    save.vibrate = e.target.checked;
    store.save(save);
    vibrate(20);
  });
  $('reset-btn').addEventListener('click', () => {
    if (confirm('Start over from level 1? Your stars will be cleared.')) {
      save = store.reset();
      setSoundEnabled(save.sound);
      openSettings();
    }
  });
  $('settings-close').addEventListener('click', () => { play('click'); history.back(); });

  if (location.search.includes('debug')) window.cubeAway = { game, startLevel };

  history.replaceState({ screen: 'home' }, '');
  show('home');

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
