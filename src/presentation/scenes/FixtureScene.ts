import Phaser from 'phaser';
import { COLOR_TOKENS } from '../designTokens.ts';
import { applyDesignViewport } from '../designViewport.ts';
import { runFixtureSolution } from '../../application/fixtureRunner.ts';
import { GRID_HEIGHT, GRID_WIDTH } from '../../domain/model.ts';

const BOARD_X = 104;
const BOARD_Y = 168;
const BOARD_W = 512;
const BOARD_H = 768;
const CELL_SIZE = 4;

export class FixtureScene extends Phaser.Scene {
  private boardGraphics!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'FixtureScene' });
  }

  create(): void {
    applyDesignViewport(this);
    // Tiêu đề mốc M0
    this.add.text(360, 80, 'M0 · Fixture Kỹ Thuật', {
      fontFamily: 'sans-serif',
      fontSize: '28px',
      color: '#EEF4FA',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(360, 120, 'Song thoi tiếp giáp đỉnh · Hai mảnh không xếp chồng', {
      fontFamily: 'sans-serif',
      fontSize: '16px',
      color: '#9DAFC7',
    }).setOrigin(0.5);

    // Bàn cờ nền tĩnh
    const bgGraphics = this.add.graphics();
    bgGraphics.fillStyle(0x101b32, 1);
    bgGraphics.fillRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
    bgGraphics.lineStyle(2, 0x68b8dc, 0.4);
    bgGraphics.strokeRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);

    // Graphics vẽ dynamic cells
    this.boardGraphics = this.add.graphics();

    // Dòng hiển thị trạng thái
    this.statusText = this.add.text(360, 980, '', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#FFC857',
    }).setOrigin(0.5);

    // Nút "Chạy lại"
    const rerunButton = this.add.text(360, 1050, '[ Chạy lại nghiệm ]', {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: COLOR_TOKENS.iceGlass.primaryBorder,
      backgroundColor: COLOR_TOKENS.board.surfaceTop,
      padding: { x: 24, y: 12 },
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    rerunButton.on('pointerdown', () => {
      this.renderFixture();
    });

    // Vẽ lần đầu
    this.renderFixture();
  }

  private renderFixture(): void {
    const result = runFixtureSolution();

    this.boardGraphics.clear();
    this.boardGraphics.fillStyle(0xffc857, 1);

    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const idx = y * GRID_WIDTH + x;
        if (result.mask[idx] === 1) {
          this.boardGraphics.fillRect(
            BOARD_X + x * CELL_SIZE,
            BOARD_Y + y * CELL_SIZE,
            CELL_SIZE,
            CELL_SIZE
          );
        }
      }
    }

    this.statusText.setText(
      `Trạng thái: ${result.state.phase.toUpperCase()} · Nghiệm khớp 100% mục tiêu`
    );
  }
}
