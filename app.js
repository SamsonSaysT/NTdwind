(() => {
  "use strict";

  const carousel = document.querySelector("[data-carousel]");
  const track = carousel.querySelector(".carousel-track");
  const slides = Array.from(carousel.querySelectorAll(".slide"));
  const previousButton = carousel.querySelector(".previous");
  const nextButton = carousel.querySelector(".next");
  const dotsContainer = carousel.querySelector(".carousel-dots");
  const currentReadout = document.getElementById("carousel-current");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let slideIndex = 0;
  let autoTimer = null;
  let touchStartX = 0;

  const dots = slides.map((_, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "carousel-dot";
    dot.setAttribute("aria-label", `Show photo ${index + 1}`);
    dot.addEventListener("click", () => showSlide(index, true));
    dotsContainer.append(dot);
    return dot;
  });

  function showSlide(index, userInitiated = false) {
    slideIndex = (index + slides.length) % slides.length;
    track.style.transform = `translateX(-${slideIndex * 100}%)`;
    currentReadout.textContent = String(slideIndex + 1).padStart(2, "0");

    slides.forEach((slide, i) => {
      const active = i === slideIndex;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", String(!active));
    });

    dots.forEach((dot, i) => {
      const active = i === slideIndex;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-current", active ? "true" : "false");
    });

    if (userInitiated) restartAutoPlay();
  }

  function startAutoPlay() {
    if (reduceMotion) return;
    window.clearInterval(autoTimer);
    autoTimer = window.setInterval(() => showSlide(slideIndex + 1), 5200);
  }

  function stopAutoPlay() {
    window.clearInterval(autoTimer);
    autoTimer = null;
  }

  function restartAutoPlay() {
    stopAutoPlay();
    startAutoPlay();
  }

  previousButton.addEventListener("click", () => showSlide(slideIndex - 1, true));
  nextButton.addEventListener("click", () => showSlide(slideIndex + 1, true));
  carousel.addEventListener("mouseenter", stopAutoPlay);
  carousel.addEventListener("mouseleave", startAutoPlay);
  carousel.addEventListener("focusin", stopAutoPlay);
  carousel.addEventListener("focusout", startAutoPlay);

  track.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0].clientX;
  }, { passive: true });

  track.addEventListener("touchend", (event) => {
    const distance = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(distance) < 45) return;
    showSlide(slideIndex + (distance < 0 ? 1 : -1), true);
  }, { passive: true });

  showSlide(0);
  startAutoPlay();

  const canvas = document.getElementById("game-board");
  const context = canvas.getContext("2d", { alpha: false });
  const scoreOutput = document.getElementById("score");
  const banner = document.getElementById("game-banner");
  const message = document.getElementById("game-message");
  const newGameButton = document.getElementById("new-game");

  const COLS = 10;
  const ROWS = 16;
  const CELL = 32;
  const DROP_TIME = 720;
  const SOFT_DROP_TIME = 45;
  const YELLOW = "#ffd500";
  const YELLOW_HOT = "#ffe600";
  const BLACK = "#080808";

  const PIECES = {
    I: [[1, 1, 1, 1]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1]],
    L: [[1, 0], [1, 0], [1, 1]],
    J: [[0, 1], [0, 1], [1, 1]],
    S: [[0, 1, 1], [1, 1, 0]],
    Z: [[1, 1, 0], [0, 1, 1]]
  };

  let grid = createGrid();
  let current = null;
  let score = 0;
  let playing = false;
  let dropInterval = DROP_TIME;
  let lastDrop = 0;
  let animationId = null;

  function createGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  function cloneMatrix(matrix) {
    return matrix.map((row) => [...row]);
  }

  function randomPiece() {
    const types = Object.keys(PIECES);
    const type = types[Math.floor(Math.random() * types.length)];
    const matrix = cloneMatrix(PIECES[type]);

    return {
      type,
      matrix,
      x: Math.floor((COLS - matrix[0].length) / 2),
      y: 0
    };
  }

  function collides(piece, offsetX = 0, offsetY = 0, matrix = piece.matrix) {
    for (let y = 0; y < matrix.length; y += 1) {
      for (let x = 0; x < matrix[y].length; x += 1) {
        if (!matrix[y][x]) continue;

        const boardX = piece.x + x + offsetX;
        const boardY = piece.y + y + offsetY;

        if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return true;
        if (boardY >= 0 && grid[boardY][boardX]) return true;
      }
    }

    return false;
  }

  function mergePiece() {
    current.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (!value) return;
        const boardY = current.y + y;
        const boardX = current.x + x;
        if (boardY >= 0) grid[boardY][boardX] = 1;
      });
    });
  }

  function updateScore() {
    scoreOutput.textContent = String(score).padStart(4, "0");
  }

  function clearLines() {
    let cleared = 0;

    for (let y = ROWS - 1; y >= 0; y -= 1) {
      if (grid[y].every(Boolean)) {
        grid.splice(y, 1);
        grid.unshift(Array(COLS).fill(0));
        cleared += 1;
        y += 1;
      }
    }

    if (cleared) {
      const points = [0, 10, 30, 60, 100];
      score += points[cleared];
      updateScore();
    }
  }

  function spawnPiece() {
    current = randomPiece();
    if (collides(current)) endGame();
  }

  function lockPiece() {
    mergePiece();
    clearLines();
    spawnPiece();
  }

  function move(direction) {
    if (!playing || !current) return;
    if (!collides(current, direction, 0)) current.x += direction;
    draw();
  }

  function stepDown() {
    if (!playing || !current) return;

    if (!collides(current, 0, 1)) {
      current.y += 1;
    } else {
      lockPiece();
    }

    draw();
  }

  function rotateMatrix(matrix) {
    return matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());
  }

  function rotatePiece() {
    if (!playing || !current || current.type === "O") return;

    const rotated = rotateMatrix(current.matrix);
    const kicks = [0, -1, 1, -2, 2];

    for (const kick of kicks) {
      if (!collides(current, kick, 0, rotated)) {
        current.x += kick;
        current.matrix = rotated;
        break;
      }
    }

    draw();
  }

  function drawCell(x, y, occupied) {
    const px = x * CELL;
    const py = y * CELL;

    context.fillStyle = BLACK;
    context.fillRect(px, py, CELL, CELL);

    context.fillStyle = occupied ? BLACK : YELLOW;
    context.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);

    if (occupied) {
      context.fillStyle = YELLOW_HOT;
      context.fillRect(px + 7, py + 7, 6, 6);
      context.fillRect(px + 19, py + 19, 6, 6);
    }
  }

  function draw() {
    context.fillStyle = BLACK;
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        drawCell(x, y, Boolean(grid[y][x]));
      }
    }

    if (current) {
      current.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value && current.y + y >= 0) {
            drawCell(current.x + x, current.y + y, true);
          }
        });
      });
    }
  }

  function gameLoop(timestamp = 0) {
    if (!playing) return;

    if (timestamp - lastDrop >= dropInterval) {
      stepDown();
      lastDrop = timestamp;
    }

    animationId = window.requestAnimationFrame(gameLoop);
  }

  function startGame() {
    window.cancelAnimationFrame(animationId);
    grid = createGrid();
    current = null;
    score = 0;
    updateScore();
    playing = true;
    dropInterval = DROP_TIME;
    lastDrop = performance.now();
    banner.hidden = true;
    spawnPiece();
    draw();
    animationId = window.requestAnimationFrame(gameLoop);
  }

  function endGame() {
    playing = false;
    window.cancelAnimationFrame(animationId);
    message.textContent = "GAME OVER.";
    newGameButton.textContent = "TRY AGAIN";
    banner.hidden = false;
  }

  function setSoftDrop(active) {
    dropInterval = active ? SOFT_DROP_TIME : DROP_TIME;
  }

  function bindRepeatButton(button, action) {
    let repeatTimer = null;
    let repeatInterval = null;

    const stop = () => {
      window.clearTimeout(repeatTimer);
      window.clearInterval(repeatInterval);
      repeatTimer = null;
      repeatInterval = null;
      button.classList.remove("is-pressed");
      if (button.id === "down") setSoftDrop(false);
    };

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.classList.add("is-pressed");
      action();
      if (button.id === "down") setSoftDrop(true);
      repeatTimer = window.setTimeout(() => {
        repeatInterval = window.setInterval(action, 85);
      }, 220);
    });

    button.addEventListener("pointerup", stop);
    button.addEventListener("pointercancel", stop);
    button.addEventListener("pointerleave", stop);
    button.addEventListener("click", (event) => event.preventDefault());
  }

  document.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key)) {
      event.preventDefault();
    }

    if (event.repeat && event.key === "ArrowUp") return;

    switch (event.key) {
      case "ArrowLeft":
        move(-1);
        break;
      case "ArrowRight":
        move(1);
        break;
      case "ArrowUp":
        rotatePiece();
        break;
      case "ArrowDown":
        setSoftDrop(true);
        stepDown();
        break;
      case "n":
      case "N":
        startGame();
        break;
      default:
        break;
    }
  });

  document.addEventListener("keyup", (event) => {
    if (event.key === "ArrowDown") setSoftDrop(false);
  });

  newGameButton.addEventListener("click", startGame);
  bindRepeatButton(document.getElementById("left"), () => move(-1));
  bindRepeatButton(document.getElementById("right"), () => move(1));
  bindRepeatButton(document.getElementById("rotate"), rotatePiece);
  bindRepeatButton(document.getElementById("down"), stepDown);

  message.textContent = "READY?";
  newGameButton.textContent = "START";
  updateScore();
  draw();
})();
