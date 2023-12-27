import { inject, injectable } from "inversify";
import {
    AbstractUIExtension,
    IActionDispatcher,
    MouseListener,
    SChildElementImpl,
    SModelElementImpl,
    SModelRootImpl,
    SetUIExtensionVisibilityAction,
    TYPES,
} from "sprotty";
import { Action } from "sprotty-protocol";
import { GdprNodeImpl } from "./nodes";

import "./validationErrorsPopup.css";

@injectable()
export class GdprValidationResultPopupMouseListener extends MouseListener {
    private stillTimeout: NodeJS.Timeout | undefined;
    private lastPosition = { x: 0, y: 0 };

    constructor(@inject(TYPES.IActionDispatcher) private readonly actionDispatcher: IActionDispatcher) {
        super();
    }

    mouseMove(target: SModelElementImpl, event: MouseEvent): (Action | Promise<Action>)[] {
        const gdprNode = this.findGdprNode(target);
        if (!gdprNode) {
            if (this.stillTimeout) {
                clearTimeout(this.stillTimeout);
                this.stillTimeout = undefined;
            }
            return [];
        }

        if (this.lastPosition.x !== event.clientX || this.lastPosition.y !== event.clientY) {
            this.lastPosition = { x: event.clientX, y: event.clientY };
            // Mouse has moved, so we reset the timeout
            if (this.stillTimeout) {
                clearTimeout(this.stillTimeout);
            }
            this.stillTimeout = setTimeout(() => {
                // When the mouse has not moved for 500ms, we show the popup
                this.stillTimeout = undefined;
                this.showPopup(gdprNode);
            }, 500);
        }

        return [];
    }

    private findGdprNode(currentNode: SModelElementImpl): GdprNodeImpl | undefined {
        if (currentNode instanceof GdprNodeImpl) {
            return currentNode;
        } else if (currentNode instanceof SChildElementImpl && currentNode.parent) {
            return this.findGdprNode(currentNode.parent);
        } else {
            return undefined;
        }
    }

    private showPopup(target: GdprNodeImpl): void {
        if (target.validateNode() === true) {
            // no validation errors, all fine. No need to show the popup.
            return;
        }

        this.actionDispatcher.dispatch(
            SetUIExtensionVisibilityAction.create({
                extensionId: GdprValidationResultPopupUI.ID,
                visible: true,
                contextElementsId: [target.id],
            }),
        );
    }

    public getMousePosition(): { x: number; y: number } {
        return this.lastPosition;
    }
}

@injectable()
export class GdprValidationResultPopupUI extends AbstractUIExtension {
    static readonly ID = "gdpr-validation-result-popup";

    private readonly validationParagraph = document.createElement("p") as HTMLParagraphElement;

    constructor(
        @inject(GdprValidationResultPopupMouseListener)
        private readonly mouseListener: GdprValidationResultPopupMouseListener,
    ) {
        super();
    }

    id(): string {
        return GdprValidationResultPopupUI.ID;
    }

    containerClass(): string {
        return this.id();
    }

    protected override initializeContents(containerElement: HTMLElement): void {
        containerElement.classList.add("ui-float");
        containerElement.appendChild(this.validationParagraph);

        containerElement.addEventListener("mouseleave", () => {
            this.hide();
        });
    }

    protected override onBeforeShow(
        containerElement: HTMLElement,
        root: Readonly<SModelRootImpl>,
        ...contextElementIds: string[]
    ): void {
        if (contextElementIds.length !== 1) {
            this.validationParagraph.innerText =
                "UI Error: Expected exactly one context element id, but got " + contextElementIds.length;
            return;
        }

        const node = root.index.getById(contextElementIds[0]);
        if (!(node instanceof GdprNodeImpl)) {
            this.validationParagraph.innerText =
                "UI Error: Expected context element to be a GdprNodeImpl, but got " + node;
            return;
        }

        const validationResults = node.validateNode();
        if (validationResults === true) {
            // no validation errors, all fine. No need to show the popup.
            this.hide();
            return;
        }

        const mousePosition = this.mouseListener.getMousePosition();
        // 2 offset to ensure the mouse is inside the popup when showing it.
        // Otherwise it would be on the gdpr node because of the rounded corners.
        // The cursor should be inside the popup when opening it for the closing
        // using the mouseleave event to work correctly.
        containerElement.style.left = `${mousePosition.x - 2}px`;
        containerElement.style.top = `${mousePosition.y - 2}px`;

        this.validationParagraph.innerText = "This node is invalid because";
        const validationUnorderedList = document.createElement("ul");
        validationResults.forEach((validationResult) => {
            const validationListItem = document.createElement("li");
            validationListItem.innerText = validationResult;
            validationUnorderedList.appendChild(validationListItem);
        });

        this.validationParagraph.appendChild(validationUnorderedList);
    }
}
