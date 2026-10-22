import type Phaser from 'phaser';

/** Block empty panel space and dismiss only a press/release that begins outside. */
export function createDialogPanelInput(
  scene: Phaser.Scene,
  backdrop: Phaser.GameObjects.Rectangle,
  width: number,
  height: number,
  onOutsideTap: () => void
): Phaser.GameObjects.Zone {
  const outsidePointers = new Set<number>();
  const stop = (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
    event.stopPropagation();
  };
  backdrop.on('pointerdown', (pointer: Phaser.Input.Pointer, x: number, y: number, event: Phaser.Types.Input.EventData) => {
    stop(pointer, x, y, event);
    outsidePointers.add(pointer.id);
  });
  backdrop.on('pointerup', (pointer: Phaser.Input.Pointer, x: number, y: number, event: Phaser.Types.Input.EventData) => {
    stop(pointer, x, y, event);
    if (outsidePointers.delete(pointer.id)) onOutsideTap();
  });
  backdrop.on('pointerout', (pointer: Phaser.Input.Pointer) => outsidePointers.delete(pointer.id));
  backdrop.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => outsidePointers.delete(pointer.id));

  const panelInput = scene.add.zone(0, 0, width, height).setInteractive();
  panelInput.on('pointerdown', stop);
  panelInput.on('pointerup', stop);
  return panelInput;
}
