export type FtueStep = {
  id: string;
  trigger: 'idle' | 'first-snap' | 'two-layers' | 'three-layers';
  end: 'drag-start' | 'snap' | 'two-layers' | 'three-layers';
  text: string;
};

export type FtueState = {
  stepId: string | null;
  visible: boolean;
  text: string | null;
};

export class FtueController {
  private steps: readonly FtueStep[];
  private currentStep: FtueStep | null = null;
  private isVisible: boolean = false;
  private completedSteps = new Set<string>();

  constructor(steps: readonly FtueStep[] = []) {
    this.steps = steps;
    // Bắt đầu với bước trigger 'idle' nếu có
    const idleStep = this.steps.find((s) => s.trigger === 'idle');
    if (idleStep) {
      this.currentStep = idleStep;
      this.isVisible = true;
    }
  }

  getState(): FtueState {
    return {
      stepId: this.currentStep ? this.currentStep.id : null,
      visible: this.isVisible,
      text: this.currentStep && this.isVisible ? this.currentStep.text : null,
    };
  }

  onAction(action: 'drag-start' | 'snap' | 'two-layers' | 'three-layers'): void {
    if (this.currentStep && this.currentStep.end === action) {
      this.completedSteps.add(this.currentStep.id);
      this.isVisible = false;
      this.currentStep = null;
    }
  }

  onEvent(trigger: 'first-snap' | 'two-layers' | 'three-layers'): void {
    const nextStep = this.steps.find(
      (s) => s.trigger === trigger && !this.completedSteps.has(s.id)
    );
    if (nextStep) {
      this.currentStep = nextStep;
      this.isVisible = true;
    }
  }
}
