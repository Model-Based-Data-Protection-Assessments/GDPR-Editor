import { inject, injectable } from "inversify";
import {
    AbstractUIExtension,
    Command,
    CommandExecutionContext,
    CommandReturn,
    CommitModelAction,
    IActionDispatcher,
    SGraphImpl,
    TYPES,
    ViewerOptions,
    getAbsoluteClientBounds,
} from "sprotty";
import { GdprEdgeImpl } from "./edges";
import { Point } from "sprotty-protocol";
import { matchesKeystroke } from "sprotty/lib/utils/keyboard";
import { DOMHelper } from "sprotty/lib/base/views/dom-helper";

@injectable()
export class EdgeMultiplicityEditUI extends AbstractUIExtension {
    static readonly ID = "edge-multiplicity-edit-ui";

    private edge: GdprEdgeImpl | undefined;
    private multiplicityPosition: Point | undefined;
    private multiplicityInput: HTMLInputElement = document.createElement("input");

    constructor(
        @inject(TYPES.IActionDispatcher) private actionDispatcher: IActionDispatcher,
        @inject(TYPES.DOMHelper) private domHelper: DOMHelper,
        @inject(TYPES.ViewerOptions) private viewerOptions: ViewerOptions,
    ) {
        super();
    }

    id(): string {
        return EdgeMultiplicityEditUI.ID;
    }

    containerClass(): string {
        return this.id();
    }

    public setEdge(edge: GdprEdgeImpl, multiplicityPosition: Point): void {
        this.edge = edge;
        this.multiplicityPosition = multiplicityPosition;
    }

    protected initializeContents(containerElement: HTMLElement): void {
        this.multiplicityInput.autocomplete = "off";
        this.multiplicityInput.spellcheck = false;
        this.multiplicityInput.placeholder = "Multiplicity";

        containerElement.appendChild(this.multiplicityInput);
        containerElement.classList.add("ui-float");

        this.configureHandlers();
    }

    private configureHandlers(): void {
        this.multiplicityInput.addEventListener("blur", () => {
            this.saveAndHide();
        });

        this.multiplicityInput.addEventListener("keydown", (event: KeyboardEvent) => {
            if (matchesKeystroke(event, "Escape")) {
                // Cancel edit and restore old value
                this.multiplicityInput.value = this.edge?.multiplicity ?? "";
                this.saveAndHide();
            } else if (matchesKeystroke(event, "Enter")) {
                this.saveAndHide();
            }
        });
    }

    private convertDiagramPositionToScreenPosition(diagramPosition: Point, root: Readonly<SGraphImpl>): Point {
        if (!this.edge || !this.edge.target) {
            return { x: 0, y: 0 };
        }

        // Offset from target node to the render position of the multiplicity input
        const diagramOffsetToTargetElement = Point.subtract(diagramPosition, this.edge.target.bounds);

        // Get position of the target node on the client including current position in the diagram
        // and the zoom level
        const zoom = root.zoom ?? 1;
        const targetElementClientBounds = getAbsoluteClientBounds(this.edge.target, this.domHelper, this.viewerOptions);
        return {
            // Calculate multiplicity position on screen by applying the zoom-scaled offset
            x: targetElementClientBounds.x + diagramOffsetToTargetElement.x * zoom,
            y: targetElementClientBounds.y + diagramOffsetToTargetElement.y * zoom,
        };
    }

    protected onBeforeShow(
        containerElement: HTMLElement,
        root: Readonly<SGraphImpl>,
        ..._contextElementIds: string[]
    ): void {
        this.multiplicityInput.value = this.edge?.multiplicity ?? "";
        const screenPosition = this.convertDiagramPositionToScreenPosition(
            this.multiplicityPosition ?? { x: 0, y: 0 },
            root,
        );
        containerElement.style.left = `${screenPosition.x ?? 0}px`;
        containerElement.style.top = `${screenPosition.y ?? 0}px`;

        // Focus the input field after the element is rendered
        setTimeout(() => {
            this.multiplicityInput.focus();
        });
    }

    private saveAndHide(): void {
        if (this.edge) {
            const newMultiplicity = this.multiplicityInput.value;
            if (newMultiplicity !== this.edge.multiplicity) {
                // Update value and commit changed model
                this.actionDispatcher.dispatch(SetEdgeMultiplicityAction.create(this.edge, newMultiplicity));
                this.actionDispatcher.dispatch(CommitModelAction.create());
            }
        }

        this.hide();
    }
}

export interface SetEdgeMultiplicityAction {
    kind: typeof SetEdgeMultiplicityAction.KIND;
    edge: GdprEdgeImpl;
    newMultiplicityValue: string;
}
export namespace SetEdgeMultiplicityAction {
    export const KIND = "setEdgeMultiplicity";
    export function create(edge: GdprEdgeImpl, newMultiplicityValue: string): SetEdgeMultiplicityAction {
        return {
            kind: SetEdgeMultiplicityAction.KIND,
            edge,
            newMultiplicityValue,
        };
    }
}

@injectable()
export class SetEdgeMultiplicityCommand extends Command {
    static readonly KIND = SetEdgeMultiplicityAction.KIND;

    private oldValue?: string;

    constructor(@inject(TYPES.Action) private action: SetEdgeMultiplicityAction) {
        super();
    }

    execute(context: CommandExecutionContext): CommandReturn {
        this.oldValue = this.action.edge.multiplicity;

        // when empty string, then save undefined so that it does not create a text element
        // which must be rendered and updated
        this.action.edge.multiplicity = this.action.newMultiplicityValue || undefined;

        return context.root;
    }

    undo(context: CommandExecutionContext): CommandReturn {
        this.action.edge.multiplicity = this.oldValue;
        return context.root;
    }

    redo(context: CommandExecutionContext): CommandReturn {
        this.action.edge.multiplicity = this.action.newMultiplicityValue || undefined;
        return context.root;
    }
}
