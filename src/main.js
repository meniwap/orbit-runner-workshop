import './style.css';
import { createGame } from './game.js';

document.querySelector('#app').innerHTML = `
  <div class="shell">
    <div class="menu">
      <div class="title">Orbit Runner</div>
      <div class="subtitle">A tiny Canvas shooter for Git + Playwright practice</div>
      <button id="start-btn" type="button">Start</button>
      <div class="controls">
        <div><span class="key">Arrows</span> Move</div>
        <div><span class="key">Mouse</span> Aim</div>
        <div><span class="key">Click</span> Shoot</div>
        <div><span class="key">B</span> Pause</div>
        <div><span class="key">A</span> Restart</div>
        <div><span class="key">F</span> Fullscreen</div>
        <div><span class="key">Esc</span> Exit fullscreen</div>
      </div>
    </div>
    <div class="stage">
      <canvas id="game" aria-label="Orbit Runner"></canvas>
    </div>
  </div>
`;

const canvas = document.querySelector('#game');
const startBtn = document.querySelector('#start-btn');
const game = createGame({ canvas, startBtn });
game.attach();
